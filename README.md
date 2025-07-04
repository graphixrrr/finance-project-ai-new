# Finance AI Project

A comprehensive finance application with AI-powered stock prediction capabilities, featuring a React frontend and Python Flask backend.

## Project Structure

```
finance-project-ai-new/
├── frontend/          # React TypeScript frontend
├── backend/           # Python Flask backend with AI models
├── stock_model.h5     # Trained stock prediction model
├── stock_model.keras  # Keras model file
└── package.json       # Root package configuration
```

## Features

- **AI Stock Prediction**: Machine learning models for stock price prediction
- **Modern Frontend**: React with TypeScript and modern UI components
- **RESTful API**: Flask backend with comprehensive endpoints
- **Real-time Data**: Integration with financial data APIs
- **Responsive Design**: Mobile-friendly interface

## Technology Stack

### Frontend
- React 19.1.0
- TypeScript
- Recharts for data visualization
- Axios for API communication

### Backend
- Python Flask
- Keras/TensorFlow for ML models
- Pandas for data manipulation
- NumPy for numerical computations

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+
- pip

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd finance-project-ai-new
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

4. **Set up Python virtual environment (recommended)**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   python app.py
   ```
   The backend will run on `http://localhost:5000`

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```
   The frontend will run on `http://localhost:3000`

## API Endpoints

The backend provides various endpoints for:
- Stock data retrieval
- Price predictions
- Historical data analysis
- Model training and updates

## AI Models

The project includes pre-trained models:
- `stock_model.h5` - HDF5 format model
- `stock_model.keras` - Keras format model
- `AAPL.keras` - Apple stock specific model

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please open an issue in the repository.
