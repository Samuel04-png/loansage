# AI Features with DeepSeek Integration

This application uses DeepSeek API for intelligent AI-powered features including:

## Features

1. **Collateral Valuation** - AI-powered market price estimation for Zambian market
2. **Risk Scoring** - Intelligent loan and customer risk assessment
3. **Predictive Analytics** - Default prediction and portfolio analysis

## Setup

1. Add your DeepSeek API key to `.env` or `.env.local`:
```
VITE_DEEP_SEEK_API_KEY=sk-your-api-key-here
```

2. The API key is automatically loaded from environment variables.

## How It Works

- **Primary**: Uses DeepSeek API for intelligent analysis when configured
- **Fallback**: Falls back to rule-based algorithms if API is unavailable or fails

## API Usage

The DeepSeek client (`deepseek-client.ts`) handles:
- API authentication
- Request formatting
- Response parsing
- Error handling

## Features Using DeepSeek

### Collateral Pricing
- Market value estimation
- Sale price recommendations
- Market analysis
- Profit/loss calculations

### Risk Scoring
- Customer risk assessment
- Loan approval recommendations
- Default probability prediction
- Anomaly detection

## Error Handling

All AI features gracefully fall back to rule-based algorithms if:
- API key is not configured
- API request fails
- API response is invalid

This ensures the application continues to work even without API access.

