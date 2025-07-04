import requests

FINNHUB_API_KEY = "d1ea44hr01qjssriqvegd1ea44hr01qjssriqvf0"

def get_symbol(query):
    url = f"https://finnhub.io/api/v1/search?q={query}&token={FINNHUB_API_KEY}"
    res = requests.get(url).json()
    if res.get('count', 0) == 0:
        return None
    return res['result'][0]['symbol']

def get_current_price(symbol):
    url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
    data = requests.get(url).json()
    return data.get('c')

def main():
    query = input("What stock do you want to know more about? ")
    symbol = get_symbol(query)
    if not symbol:
        print(f"Sorry, couldn't find a stock symbol for '{query}'.")
        return

    price = get_current_price(symbol)
    if price is None:
        print(f"Sorry, couldn't get the price for symbol '{symbol}'.")
        return

    print(f"The current price of {symbol} is ${price}")

if __name__ == "__main__":
    main()
