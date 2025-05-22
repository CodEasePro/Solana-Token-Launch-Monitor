// Constants
const ALARM_NAME = 'mempoolCheck';
const STATUS_KEY = 'monitoringStatus';
const ALERTS_KEY = 'alerts';
const API_KEY_STORAGE_KEY = 'solanaApiKey'; // For future use, currently just logged

// Solana RPC Configuration
// Note: For production use, users might want to configure their own RPC URL,
// possibly one that requires an API key, via an options page (not in scope for this iteration).
// Public RPCs are rate-limited.
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const TARGET_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'; // Raydium AMM V4 Program ID
const LAUNCHPAD_NAME_FOR_TARGET_ID = 'Raydium'; // Mapping for the current TARGET_PROGRAM_ID
const LAST_PROCESSED_SIGNATURE_KEY_PREFIX = 'lastProcessedSignatureFor_';

const MAX_ALERTS = 20;

// --- Initialization Function ---
function initializeExtensionState() {
    console.log('Background: Initializing extension state...');
    chrome.storage.local.set({ [STATUS_KEY]: 'Initializing...' }, () => {
        if (chrome.runtime.lastError) {
            console.error('Background: Error setting initial status to Initializing...:', chrome.runtime.lastError.message);
        } else {
            console.log('Background: Status set to Initializing...');
        }
    });

    chrome.storage.local.get(API_KEY_STORAGE_KEY, (result) => {
        if (chrome.runtime.lastError) {
            console.error('Background: Error fetching API key:', chrome.runtime.lastError.message);
        } else {
            if (result[API_KEY_STORAGE_KEY]) {
                console.log('Background: Solana API Key found (placeholder, not used for core logic in this MVP). User would need to append it to RPC URL if required.');
            } else {
                console.log('Background: Solana API Key not found. Using public RPC.');
            }
        }
    });

    chrome.alarms.get(ALARM_NAME, (existingAlarm) => {
        if (chrome.runtime.lastError) {
            console.error('Background: Error checking for existing alarm:', chrome.runtime.lastError.message);
        }
        if (!existingAlarm) {
            chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
            console.log(`Background: Alarm '${ALARM_NAME}' created to fire every 1 minute.`);
        } else {
            console.log(`Background: Alarm '${ALARM_NAME}' already exists. Period: ${existingAlarm.periodInMinutes} minutes.`);
        }
        chrome.storage.local.set({ [STATUS_KEY]: 'Monitoring' }, () => {
            if (chrome.runtime.lastError) {
                console.error('Background: Error setting status to Monitoring:', chrome.runtime.lastError.message);
            } else {
                console.log('Background: Status set to Monitoring.');
            }
        });
    });
}


// --- Event Listeners ---

chrome.runtime.onInstalled.addListener((details) => {
    console.log(`Background: Extension ${details.reason}. Previous version: ${details.previousVersion || 'N/A'}`);
    initializeExtensionState();

    chrome.storage.local.get(ALERTS_KEY, (result) => {
        if (chrome.runtime.lastError) {
            console.error('Background: Error getting alerts on install:', chrome.runtime.lastError.message);
            chrome.storage.local.set({ [ALERTS_KEY]: [] }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Critical error initializing alerts array after a get error:', chrome.runtime.lastError.message);
                } else {
                     console.log('Background: Alerts array initialized to empty on install (after get error).');
                }
            });
            return;
        }
        if (typeof result[ALERTS_KEY] === 'undefined' || !Array.isArray(result[ALERTS_KEY])) {
            chrome.storage.local.set({ [ALERTS_KEY]: [] }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Background: Error initializing alerts array:', chrome.runtime.lastError.message);
                } else {
                    console.log('Background: Alerts array initialized to empty.');
                }
            });
        } else {
            console.log('Background: Alerts array already exists and is valid.');
        }
    });
    console.log(`Background: Monitoring program ID: ${TARGET_PROGRAM_ID}`);
});

chrome.alarms.onAlarm.addListener((alarm) => {
    console.log(`Background: Alarm '${alarm.name}' fired at ${new Date(alarm.scheduledTime).toLocaleString()}`);
    if (alarm.name === ALARM_NAME) {
        performMempoolCheck();
    }
});

// --- Core Logic: Real Mempool Check via RPC ---
async function performMempoolCheck() {
    console.log(`Background: Performing mempool check for program ${TARGET_PROGRAM_ID} via RPC: ${SOLANA_RPC_URL}`);
    const lastProcessedSignatureKey = `${LAST_PROCESSED_SIGNATURE_KEY_PREFIX}${TARGET_PROGRAM_ID}`;

    try {
        const response = await fetch(SOLANA_RPC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [
                    TARGET_PROGRAM_ID,
                    { limit: 10 } // Get the 10 most recent transactions
                ],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Background: RPC request failed with status ${response.status}: ${errorText}`);
            chrome.storage.local.set({ [STATUS_KEY]: `Error: RPC ${response.status}` }, () => {
                 if (chrome.runtime.lastError) console.error('Failed to set error status');
            });
            return;
        }

        const data = await response.json();

        if (data.error) {
            console.error('Background: RPC error:', data.error.message);
            chrome.storage.local.set({ [STATUS_KEY]: `Error: RPC ${data.error.code}` }, () => {
                if (chrome.runtime.lastError) console.error('Failed to set error status');
            });
            return;
        }

        if (!data.result || data.result.length === 0) {
            console.log('Background: No recent signatures found for the target program.');
            return;
        }

        const signatures = data.result;
        console.log(`Background: Received ${signatures.length} signatures.`);

        chrome.storage.local.get([lastProcessedSignatureKey, ALERTS_KEY], async (storageResult) => {
            if (chrome.runtime.lastError) {
                console.error('Background: Error retrieving last processed signature or alerts from storage:', chrome.runtime.lastError.message);
                return;
            }

            const lastProcessedSignature = storageResult[lastProcessedSignatureKey];
            let currentAlerts = storageResult[ALERTS_KEY] || [];
            if (!Array.isArray(currentAlerts)) {
                console.warn(`Background: Alerts in storage (key: ${ALERTS_KEY}) was not an array. Resetting to empty array.`);
                currentAlerts = [];
            }

            console.log('Background: Last processed signature for this program:', lastProcessedSignature || 'None');

            let newTransactionFoundThisCheck = false;
            let latestSignatureToStore = lastProcessedSignature; 

            for (const txInfo of signatures) { 
                const currentSignature = txInfo.signature;
                if (!latestSignatureToStore && signatures.length > 0) { 
                    latestSignatureToStore = signatures[0].signature;
                }

                if (currentSignature === lastProcessedSignature) {
                    console.log(`Background: Reached last processed signature (${currentSignature}). No newer transactions in this batch beyond this point.`);
                    break; 
                }

                if (!lastProcessedSignature || currentSignature !== lastProcessedSignature) {
                    // TODO: Extracting actual token name/symbol is complex without Solana-specific parsing libraries.
                    // Current tokenName is a placeholder based on the transaction signature.
                    const tokenName = `TokenFromTx-${currentSignature.substring(0, 6)}...`;
                    const launchpadName = LAUNCHPAD_NAME_FOR_TARGET_ID; 
                    const timestamp = txInfo.blockTime ? new Date(txInfo.blockTime * 1000).toISOString() : new Date().toISOString();

                    // Updated newAlert object structure with transactionSignature
                    const newAlert = { 
                        tokenName, 
                        launchpadName, 
                        timestamp, 
                        transactionSignature: currentSignature // Storing full signature as transactionSignature
                    };
                    console.log(`Background: New transaction detected: ${tokenName} on ${launchpadName} (TxSig: ${currentSignature})`);

                    currentAlerts.unshift(newAlert); 
                    const updatedAlerts = currentAlerts.slice(0, MAX_ALERTS);

                    const itemsToStore = {
                        [ALERTS_KEY]: updatedAlerts,
                        [lastProcessedSignatureKey]: currentSignature 
                    };

                    chrome.storage.local.set(itemsToStore, () => {
                        if (chrome.runtime.lastError) {
                            console.error('Background: Error saving new alert and last processed signature:', chrome.runtime.lastError.message);
                        } else {
                            console.log(`Background: New alert for ${tokenName} saved. Last processed signature for ${TARGET_PROGRAM_ID} updated to ${currentSignature}. Total alerts: ${updatedAlerts.length}`);
                            
                            const notificationId = `solanaTokenAlert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                            chrome.notifications.create(notificationId, {
                                type: 'basic',
                                title: '🚀 New Activity on ' + launchpadName + '!',
                                message: `${tokenName} detected. Signature: ${currentSignature.substring(0,10)}...`,
                                priority: 2
                            }, (createdNotificationId) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Background: Error creating notification:', chrome.runtime.lastError.message);
                                } else {
                                    console.log(`Background: Notification created: ${createdNotificationId}`);
                                }
                            });
                        }
                    });
                    newTransactionFoundThisCheck = true;
                    latestSignatureToStore = currentSignature; 
                    break; 
                }
            }

            if (!newTransactionFoundThisCheck && signatures.length > 0 && !lastProcessedSignature) {
                const newestSignatureInBatch = signatures[0].signature;
                if (newestSignatureInBatch !== lastProcessedSignature) { 
                    chrome.storage.local.set({ [lastProcessedSignatureKey]: newestSignatureInBatch }, () => {
                        if (chrome.runtime.lastError) {
                            console.error(`Background: Error setting initial baseline signature for ${TARGET_PROGRAM_ID} to ${newestSignatureInBatch}:`, chrome.runtime.lastError.message);
                        } else {
                            console.log(`Background: Initial baseline signature for ${TARGET_PROGRAM_ID} set to ${newestSignatureInBatch}. No new alerts generated this cycle.`);
                        }
                    });
                }
            } else if (!newTransactionFoundThisCheck) {
                 console.log(`Background: No new, unprocessed transactions found for ${TARGET_PROGRAM_ID} in this check.`);
            }
        });

    } catch (error) {
        console.error('Background: Error during performMempoolCheck fetch or processing:', error);
        chrome.storage.local.set({ [STATUS_KEY]: 'Error: Network/Fetch' }, () => {
            if (chrome.runtime.lastError) console.error('Failed to set error status');
        });
    }
}

// Initial Startup Call
console.log('Background: Service worker starting/restarting...');
initializeExtensionState();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background: Message received:', message, 'from:', sender.tab ? sender.tab.url : `Extension ID: ${sender.id}`);
    if (message.action === "forceCheck") {
        console.log("Background: Force check triggered by message.");
        performMempoolCheck().then(() => sendResponse({status: "Check initiated"}));
        return true; // Indicates asynchronous response
    }
    return false;
});