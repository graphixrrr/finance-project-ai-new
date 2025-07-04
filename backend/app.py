from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import datetime
import traceback
import logging
import requests
from google import generativeai as genai
import os

from stock_colab import run_full_pipeline

app = Flask(__name__)
CORS(app)

# Constants
MODEL_PATH = "stock_model.keras"
WINDOW_SIZE = 60
PREDICTION_DAYS = 1
NEWS_API_KEY = "70b6633e179f485eb0c19c4f6a977fb1"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyDA1avuTfGHXmPLy3rAkdA4RhMWAYBPe04")

# Use new Gemini client
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(model_name='gemini-1.5-flash')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)

def get_stock_symbol(name_or_symbol: str) -> str:
    """
    Try to interpret input as symbol.
    If invalid, try to search ticker by company name using yfinance's search.
    Returns uppercase symbol or raises Exception if not found.
    """
    import re
    name_or_symbol = name_or_symbol.strip().upper()
    # Try direct symbol lookup first
    try:
        ticker = yf.Ticker(name_or_symbol)
        hist = ticker.history(period="1d")
        if not hist.empty:
            logging.info(f"Symbol resolved directly: {name_or_symbol}")
            return name_or_symbol
    except Exception as e:
        logging.warning(f"Direct symbol lookup failed for {name_or_symbol}: {e}")
    # If direct lookup fails, try common mappings
    common_mappings = {
        'APPLE': 'AAPL',
        'GOOGLE': 'GOOGL',
        'MICROSOFT': 'MSFT',
        'AMAZON': 'AMZN',
        'TESLA': 'TSLA',
        'META': 'META',
        'NETFLIX': 'NFLX',
        'NVIDIA': 'NVDA',
        'ADOBE': 'ADBE',
        'SALESFORCE': 'CRM'
    }
    if name_or_symbol in common_mappings:
        logging.info(f"Symbol resolved from mapping: {name_or_symbol} -> {common_mappings[name_or_symbol]}")
        return common_mappings[name_or_symbol]
    # Fuzzy search using yfinance's ticker search
    try:
        search_results = yf.utils.get_ticker_by_name(name_or_symbol)
        if search_results:
            # get_ticker_by_name returns a tuple (symbol, name, exchange)
            symbol = search_results[0]
            logging.info(f"Symbol resolved by yfinance search: {name_or_symbol} -> {symbol}")
            return symbol.upper()
    except Exception as e:
        logging.warning(f"yfinance search failed for {name_or_symbol}: {e}")
    logging.error(f"Could not find a ticker symbol for '{name_or_symbol}'.")
    raise ValueError(f"Could not find a ticker symbol for '{name_or_symbol}'. Please try a valid stock symbol like AAPL, GOOGL, etc.")

def fetch_news_and_sentiment(symbol, company_name):
    """
    Fetch recent news headlines for the stock and analyze sentiment.
    Returns: (sentiment, summary, articles, sources)
    """
    try:
        # Try NewsAPI first
        url = f"https://newsapi.org/v2/everything?q={company_name or symbol}&sortBy=publishedAt&language=en&apiKey={NEWS_API_KEY}"
        resp = requests.get(url)
        if resp.status_code == 200:
            articles = resp.json().get("articles", [])[:5]
            headlines = [a["title"] for a in articles]
            sources = list(set(a["source"]["name"] for a in articles))
            # Simple sentiment: count positive/negative words
            pos_words = ["gain", "rise", "up", "positive", "beat", "growth", "record", "strong"]
            neg_words = ["fall", "down", "drop", "negative", "miss", "loss", "weak", "decline"]
            pos = sum(any(w in h.lower() for w in pos_words) for h in headlines)
            neg = sum(any(w in h.lower() for w in neg_words) for h in headlines)
            if pos > neg:
                sentiment = "Positive"
                summary = f"Recent news sentiment is positive, suggesting an upward trajectory for the stock."
            elif neg > pos:
                sentiment = "Negative"
                summary = f"Recent news sentiment is negative, suggesting a downward trajectory for the stock."
            else:
                sentiment = "Neutral"
                summary = f"Recent news sentiment is mixed or neutral."
            return sentiment, summary, headlines, sources
    except Exception as e:
        logging.warning(f"News sentiment fetch failed: {e}")
    # Fallback: neutral
    return "neutral", "No recent news sentiment available.", [], []

def fetch_gemini_news_summary(symbol, company_name):
    try:
        if not GEMINI_API_KEY:
            logging.error('Gemini API key is missing.')
            return 'neutral', 'Gemini API key is missing.', []
        url = f"https://newsapi.org/v2/everything?q={company_name or symbol}&sortBy=publishedAt&language=en&apiKey={NEWS_API_KEY}"
        resp = requests.get(url)
        articles = []
        if resp.status_code == 200:
            articles = resp.json().get("articles", [])[:8]
        headlines = [a["title"] for a in articles]
        links = [a["url"] for a in articles]
        prompt = f"""
        Analyze the following news headlines for {company_name} ({symbol}) and provide:
        1. A one-sentence summary of the overall market sentiment (positive/negative/neutral). then take a space
        2. A very short, simple, and clear summary of the news and its likely effect on the stock price. Make it three-four sentences, easy to read, and avoid long paragraphs.
        3. Make sure the information is accurate and relevant to the stock market, as well as easy to read and understand by people who may not be experts in the field. Make sure to also keep it professional
        Make sure there are no bold characters, letters, or words in your response.
        Headlines:
        {chr(10).join(headlines)}
        URLs:
        {chr(10).join(links)}
        """
        try:
            # Use Gemini Flash (free) as primary
            try:
                response = model.generate_content(
                    prompt
                )
            except Exception as e:
                logging.warning(f"Gemini model 'gemini-1.5-flash' failed: {e}")
                response = model.generate_content(
                    prompt
                )
            text = response.text
        except Exception as e:
            logging.error(f"Gemini API call failed: {e}")
            return 'neutral', 'Gemini API call failed or is not available.', []
        sentiment = 'neutral'
        if "positive" in text.lower():
            sentiment = "positive"
        elif "negative" in text.lower():
            sentiment = "negative"
        summary = text.strip()
        news_list = []
        for a in articles:
            news_list.append({"title": a["title"], "url": a["url"]})
        return sentiment, summary, news_list
    except Exception as e:
        logging.warning(f"Gemini news summary failed: {e}")
        return "neutral", "No Gemini summary available.", []

@app.route('/predict', methods=['POST'])
def predict_stock():
    data = request.json or {}
    user_input = data.get('stock', '').strip()

    if not user_input:
        return jsonify({"error": "Stock input required"}), 400

    try:
        # Resolve symbol
        symbol = get_stock_symbol(user_input)
        # Get current stock info for summary
        ticker = yf.Ticker(symbol)
        info = ticker.info
        company_name = info.get('longName', symbol)
        # Run prediction pipeline
        pipeline_result = run_full_pipeline(
            symbol,
            window_size=WINDOW_SIZE,
            prediction_days=PREDICTION_DAYS
        )
        # News sentiment
        sentiment, sentiment_summary, headlines, sources = fetch_news_and_sentiment(symbol, company_name)
        # Create a simple summary
        current_price = info.get('currentPrice', pipeline_result['actual_last_close'])
        summary = f"{company_name} ({symbol}) is currently trading at ${current_price:.2f}. "
        if pipeline_result['predicted_next_day_close'] > current_price:
            summary += f"The model predicts a potential increase to ${pipeline_result['predicted_next_day_close']:.2f} tomorrow."
        else:
            summary += f"The model predicts a potential decrease to ${pipeline_result['predicted_next_day_close']:.2f} tomorrow."
        # Build and return JSON
        response = {
            "symbol": symbol,
            **pipeline_result,
            "summary": summary,
            "current_price": current_price,
            "sentiment": sentiment,
            "sentiment_summary": sentiment_summary,
            "news_headlines": headlines,
            "news_sources": sources
        }
        logging.info(f"Prediction complete for {symbol}: Predicted ${pipeline_result['predicted_next_day_close']}, Actual ${pipeline_result['actual_last_close']}")
        return jsonify(response)
    except Exception as e:
        logging.error(f"Error in /predict route: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/news', methods=['POST'])
def news_summary():
    data = request.json or {}
    user_input = data.get('stock', '').strip()
    if not user_input:
        return jsonify({"error": "Stock input required"}), 400
    try:
        symbol = get_stock_symbol(user_input)
        ticker = yf.Ticker(symbol)
        info = ticker.info
        company_name = info.get('longName', symbol)
        sentiment, summary, articles = fetch_gemini_news_summary(symbol, company_name)
        return jsonify({
            "symbol": symbol,
            "company_name": company_name,
            "sentiment": sentiment,
            "summary": summary,
            "articles": articles
        })
    except Exception as e:
        logging.error(f"Error in /news route: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Backend is running"})


if __name__ == "__main__":
    logging.info("🚀 Starting Finance Project Backend...")
    logging.info("📊 TensorFlow and ML models ready")
    logging.info("🌐 Server will be available at http://localhost:8001")
    app.run(host="0.0.0.0", port=8001, debug=True)

    #Finally!!