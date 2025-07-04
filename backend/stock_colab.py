import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Dense, LSTM
from tensorflow.keras.callbacks import EarlyStopping
import ta
import os
from datetime import datetime

print("TensorFlow version check complete.")

# Globals
model = None
scaler = None
close_scaler = None

def download_and_preprocess(ticker, start_date, end_date, window_size=60, prediction_days=7):
    global scaler, close_scaler

    print(f"📊 Downloading data for {ticker}...")
    data = yf.download(ticker, start=start_date, end=end_date)
    
    if data.empty:
        raise ValueError(f"No data found for {ticker}. Please check the symbol.")
    
    print(f"📈 Processing {len(data)} data points...")
    
    # Add technical indicators
    data['SMA_10'] = data['Close'].rolling(window=10).mean()
    data['SMA_50'] = data['Close'].rolling(window=50).mean()
    data['RSI'] = ta.momentum.RSIIndicator(close=data['Close'].squeeze(), window=14).rsi()   
    data = data.dropna()

    if len(data) < window_size + prediction_days:
        raise ValueError(f"Insufficient data for {ticker}. Need at least {window_size + prediction_days} days of data.")

    features = ['Close', 'Volume', 'SMA_10', 'SMA_50', 'RSI']
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(data[features])

    close_scaler = MinMaxScaler()
    scaled_close = close_scaler.fit_transform(data[['Close']])

    X, y = create_dataset_multifeature(scaled_data, window_size, prediction_days)
    return X, y, data.index

def create_dataset_multifeature(dataset, window_size=60, prediction_days=7):
    X, y = [], []
    for i in range(len(dataset) - window_size - prediction_days + 1):
        X.append(dataset[i:i+window_size, :])
        y.append(dataset[i+window_size:i+window_size+prediction_days, 0])  # Close only
    return np.array(X), np.array(y)

def build_model(window_size, feature_count, prediction_days):
    global model
    model = Sequential()
    model.add(LSTM(50, return_sequences=True, input_shape=(window_size, feature_count)))
    model.add(LSTM(50))
    model.add(Dense(prediction_days))
    model.compile(optimizer='adam', loss='mean_squared_error', metrics=['mae'])
    return model

def train_model(X_train, y_train, epochs=50, batch_size=32):  # Reduced epochs for faster training
    global model
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
    print(f"🤖 Training model for {epochs} epochs...")
    return model.fit(X_train, y_train, epochs=epochs, batch_size=batch_size, validation_split=0.1, callbacks=[early_stop], verbose=0)

def save_model(path='stock_model.keras'):
    global model
    if model:
        model.save(path)

def load_trained_model(path='stock_model.keras'):
    global model
    if os.path.exists(path):
        model = load_model(path)
    else:
        raise FileNotFoundError(f"{path} not found.")

def predict(X):
    global model
    return model.predict(X, verbose=0)

def inverse_scale(data):
    global close_scaler
    return close_scaler.inverse_transform(data)

def run_full_pipeline(ticker, window_size=60, prediction_days=7):
    """
    Full process for external call:
    - download and preprocess stock data
    - train model
    - predict on test set
    - return last prediction, last actual, margin of error
    """
    try:
        start_date = '2020-01-01'
        end_date = datetime.today().strftime('%Y-%m-%d')

        X, y, dates = download_and_preprocess(ticker, start_date, end_date, window_size, prediction_days)

        split = int(len(X) * 0.8)
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]

        build_model(window_size, X.shape[2], prediction_days)
        train_model(X_train, y_train)

        save_model()
        load_trained_model()

        preds = predict(X_test)
        predicted = inverse_scale(preds)[:, 0]
        actual = inverse_scale(y_test)[:, 0]

        last_predicted = predicted[-1]
        last_actual = actual[-1]
        margin_of_error = abs(last_predicted - last_actual)

        print(f"✅ Prediction complete for {ticker}")
        print(f"   Predicted: ${last_predicted:.2f}")
        print(f"   Actual: ${last_actual:.2f}")
        print(f"   Margin: ${margin_of_error:.2f}")

        return {
            "predicted_next_day_close": float(round(last_predicted, 2)),
            "actual_last_close": float(round(last_actual, 2)),
            "margin_of_error": float(round(margin_of_error, 2)),
            "historical": [
                {
                    "date": str(dates[-len(actual):][i].date()),
                    "actual": float(actual[i]),
                    "predicted": float(predicted[i])
                }
                for i in range(len(actual))
            ]
        }
    except Exception as e:
        print(f"❌ Error in prediction pipeline: {e}")
        raise e

if __name__ == "__main__":
    # Example usage:
    result = run_full_pipeline("AAPL")
    print(result)

    #Finally!!