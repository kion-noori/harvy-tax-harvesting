# Harvy - Bitcoin Ordinal Tax Harvesting Platform

A full-stack web application for viewing, managing, and tax-loss harvesting Bitcoin Ordinals (NFTs on Bitcoin).

## Features

- **Bitcoin Wallet Integration**: Connect via Xverse wallet to view your Ordinals
- **Ordinal Display**: Browse all inscriptions owned by your Taproot address
- **Secure Storage**: Encrypted wallet address storage
- **Performance Optimized**: In-memory caching and rate limiting
- **Tax Harvesting**: (Coming soon) Track cost basis and identify tax-loss harvesting opportunities

## Tech Stack

- **Frontend**: React 18, React Router, Tailwind-inspired styling
- **Backend**: Node.js + Express (ESM), Hiro Ordinals API, Magic Eden API
- **Wallet**: sats-connect (Xverse integration)
- **Security**: Helmet, CORS, AES encryption, rate limiting
- **Data**: In-memory caching, Magic Eden pricing integration

## Prerequisites

- Node.js 16+ and Yarn
- Bitcoin wallet (Xverse browser extension recommended)

## Getting Started

### 1. Install Dependencies

```bash
# Install root dependencies
yarn install

# Install frontend dependencies
cd frontend && yarn install && cd ..
```

### 2. Configure Environment Variables

#### Backend Configuration

Copy the example file and add your configuration:

```bash
cp .env.example .env
```

Generate a secure encryption key:

```bash
openssl rand -base64 32
```

Edit `.env` and add:
- `ENCRYPTION_KEY`: The generated key from above
- `ALLOWED_ORIGINS`: Your frontend URL (default: http://localhost:3000)
- `PORT`: Backend port (default: 3001)
- `MAGICEDEN_API_KEY`: (Optional) Your Magic Eden API key for pricing data

#### Frontend Configuration

```bash
cd frontend
cp .env .env.local  # For local overrides
```

Edit `frontend/.env` and add:
- `REACT_APP_ENCRYPTION_KEY`: **Same key as backend**
- `REACT_APP_API_URL`: Backend URL (default: http://localhost:3001)

### 3. Run Development Servers

#### Option A: Run Both Servers Concurrently

```bash
yarn dev
```

This starts:
- Backend on http://localhost:3001
- Frontend on http://localhost:3000

#### Option B: Run Separately

Terminal 1 (Backend):
```bash
yarn start
```

Terminal 2 (Frontend):
```bash
cd frontend && yarn start
```

### 4. Connect Your Wallet

1. Install [Xverse Browser Extension](https://xverse.app)
2. Open the app at http://localhost:3000
3. Click "Connect Bitcoin Wallet"
4. Approve the connection in Xverse
5. Your Ordinals will load automatically

## Project Structure

```
my-nft-project/
├── server.js                 # Express backend
├── package.json              # Root dependencies & scripts
├── .env                      # Backend environment (gitignored)
├── .env.example              # Backend env template
│
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main application
│   │   ├── components/      # React components
│   │   │   ├── BitcoinWalletButton.js
│   │   │   ├── OrdinalList.js
│   │   │   ├── OrdinalMedia.jsx
│   │   │   └── WalletStatus.js
│   │   ├── utils/
│   │   │   └── encryption.js    # AES encryption utilities
│   │   └── services/
│   │       └── userDataService.js
│   ├── public/
│   ├── package.json
│   └── .env                 # Frontend environment
│
└── README.md
```

## API Endpoints

### Backend Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/test` | GET | Health check |
| `/api/ordinals?address={addr}` | GET | Fetch inscriptions for Taproot address |
| `/api/ordinal-meta/:id` | GET | Get inscription metadata |
| `/api/ordinal-bytes/:id` | GET | Stream inscription content |
| `/api/ordinal-activity/:id` | GET | Get marketplace activity/purchase history |
| `/api/ordinal-value/:id` | GET | Get current market value/listing price |

### Rate Limits

- General API: 100 requests per 15 minutes per IP
- Ordinals endpoint: 20 requests per minute per IP

### Caching

- Ordinals list: 10 minutes (in-memory + HTTP cache)
- Metadata: 24 hours (inscription metadata is immutable)
- Content bytes: 24 hours (browser + CDN cache)

## Security Features

✅ **Implemented:**
- Helmet security headers
- CORS with origin whitelist
- AES-256 encrypted wallet storage
- Rate limiting on all API routes
- Input validation (Taproot address format)
- Request size limits (1MB max)
- Environment-based configuration

⚠️ **Important Security Notes:**

1. **Never commit `.env` files** - They contain secrets
2. **Rotate encryption keys** if exposed
3. **Use HTTPS** in production
4. **Keep dependencies updated** - Run `yarn audit` regularly

## Production Deployment

### 1. Build Frontend

```bash
cd frontend
yarn build
```

This creates an optimized build in `frontend/build/`.

### 2. Configure Production Environment

Create `.env.production` (backend):

```env
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://yourdomain.com
ENCRYPTION_KEY=your_production_key_here
```

Create `frontend/.env.production`:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENCRYPTION_KEY=your_production_key_here
NODE_ENV=production
GENERATE_SOURCEMAP=false
```

**⚠️ CRITICAL**: Use the **same encryption key** for backend and frontend!

### 3. Deploy

The backend serves the frontend build automatically in production:

```bash
# On your production server
NODE_ENV=production node server.js
```

Visit your domain - the backend will serve the React app and handle API requests.

### Recommended Hosting

- **Backend**: Railway, Render, Fly.io, or DigitalOcean
- **Frontend CDN**: Vercel, Netlify (if separated from backend)
- **Full-stack**: Single server deployment (included in server.js)

## Development

### Running Tests

```bash
# Frontend tests
cd frontend && yarn test
```

### Code Quality

The app includes:
- ESLint configuration (React + Jest)
- Webpack polyfills for Node.js crypto modules
- Craco for custom webpack config

### Common Issues

**Problem**: "REACT_APP_ENCRYPTION_KEY is not set"
**Solution**: Add the encryption key to `frontend/.env`

**Problem**: CORS errors
**Solution**: Add your frontend URL to `ALLOWED_ORIGINS` in backend `.env`

**Problem**: Wallet not connecting
**Solution**: Ensure Xverse extension is installed and unlocked

**Problem**: Ordinals not loading
**Solution**: Check that address is valid Taproot format (starts with `bc1p`, 62 characters)

## Roadmap

### Phase 1: Core Functionality ✅
- [x] Bitcoin wallet connection
- [x] Ordinal fetching and display
- [x] Security hardening
- [x] Performance optimization

### Phase 2: Tax Features 🚧
- [x] Magic Eden API integration
- [x] Price feed for marketplace ordinals
- [x] Activity/purchase history tracking
- [ ] Manual cost basis entry for minted ordinals
- [ ] Gain/loss calculation
- [ ] Tax-loss harvesting selection UI
- [ ] CSV export for tax reporting

### Phase 3: Advanced Features 📋
- [ ] Transaction signing (PSBT)
- [ ] Actual selling capability
- [ ] Portfolio analytics
- [ ] Multi-wallet support
- [ ] Mobile responsiveness improvements

## Contributing

This is a private project, but contributions are welcome:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private - All Rights Reserved

## Support

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ for the Bitcoin Ordinals community**
