# 🚀 Solana Token Launch Monitor - Chrome Extension

A powerful, lightweight Chrome Extension that monitors the **Raydium AMM V4 program** on the Solana mainnet and alerts you in real-time when new transactions occur — ideal for catching new token launches early.

## 🔍 Features

- 📡 **Real-time Monitoring** of Raydium AMM V4 Program ID
- 🔔 **Desktop Notifications** for new transactions
- 📋 **Copy Transaction Signature** directly from popup
- 🧠 Lightweight, fast, and simple to use
- 🧑‍💻 Built with developers and crypto degens in mind

## ⚙️ How It Works

The extension listens to the Solana blockchain using a public RPC endpoint. It scans for **new transaction signatures** tied to Raydium AMM V4’s program ID, and triggers a **notification** when a new transaction is detected.

> ✅ Uses Solana's public RPC URL by default  
> ⚠️ You can switch to a private RPC for better performance (see `background.js`)

## 🛠️ Installation

1. **Clone or download** this repository:

```bash
git clone https://github.com/CodEasePro/Solana-Token-Launch-Monitor.git
```

2. Open **Chrome** and go to `chrome://extensions/`

3. Enable **Developer Mode** (toggle in top right)

4. Click **"Load unpacked"** and select the extension folder

5. Pin the extension and click it to start monitoring!

## 📁 Project Structure

```
solana-token-launch-monitor/
├── manifest.json         # Chrome extension config
├── popup.html            # UI shown when extension icon is clicked
├── popup.css             # Styles for the popup
├── popup.js              # Logic to display recent tx and copy to clipboard
├── background.js         # Core logic for monitoring transactions
```

## 🔑 RPC & API Key (Optional)

- The extension uses a public RPC endpoint by default.
- You can use a private endpoint for higher reliability — just add your API key to `background.js` where indicated.

```js
const RPC_URL = "https://your-custom-solana-rpc.com"; // Replace with your private RPC
```

## ⚠️ Notes & Future Enhancements

- **Token Name Extraction**: Currently a placeholder like `TokenFromTx-xxxxx`. Real token parsing requires deeper inspection of tx data.
- **RPC Limits**: Public RPCs may rate-limit — consider switching to a paid/private option.
- **Code Comments**: More JSDoc comments can be added for future maintainability.

## 💬 Contribute / Ideas

Got ideas or want to help build more tools like this? PRs and discussions welcome!


## 📜 License

MIT © YourName
