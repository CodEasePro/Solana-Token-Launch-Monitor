document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup DOMContentLoaded');

    const monitoringStatusEl = document.getElementById('monitoringStatus');
    const alertsListEl = document.getElementById('alertsList');
    const clearAlertsButtonEl = document.getElementById('clearAlertsButton');
    const alertItemTemplate = document.getElementById('alert-item-template');

    if (!monitoringStatusEl || !alertsListEl || !clearAlertsButtonEl || !alertItemTemplate) {
        console.error('Popup DOM elements not found. Check HTML IDs, including the template.');
        if (monitoringStatusEl) {
            monitoringStatusEl.textContent = 'Error: UI elements missing.';
        }
        return;
    }

    // 1. Load Initial Monitoring Status
    console.log('Loading initial monitoring status from storage.');
    chrome.storage.local.get('monitoringStatus', (result) => {
        if (chrome.runtime.lastError) {
            console.error('Error loading monitoringStatus:', chrome.runtime.lastError.message);
            monitoringStatusEl.textContent = 'Status: Error loading';
            return;
        }
        const status = result.monitoringStatus || 'Initializing...';
        monitoringStatusEl.textContent = `Status: ${status}`;
        console.log('Monitoring status loaded:', status);
    });

    // 2. Load Initial Alerts
    console.log('Loading initial alerts from storage.');
    chrome.storage.local.get('alerts', (result) => {
        if (chrome.runtime.lastError) {
            console.error('Error loading alerts:', chrome.runtime.lastError.message);
            renderAlerts(null); 
            return;
        }
        const alerts = result.alerts || [];
        renderAlerts(alerts);
        console.log('Alerts loaded:', alerts.length);
    });

    // 3. Clear Alerts Button Event Listener
    clearAlertsButtonEl.addEventListener('click', () => {
        console.log('Clear Alerts button clicked.');
        chrome.storage.local.remove('alerts', () => {
            if (chrome.runtime.lastError) {
                console.error('Error removing alerts from storage:', chrome.runtime.lastError.message);
            } else {
                console.log('Alerts removed from storage.');
            }
            renderAlerts([]); 
        });
    });

    // Function to render alerts in the UI
    function renderAlerts(alertsArray) {
        console.log('Rendering alerts:', alertsArray);
        alertsListEl.innerHTML = ''; // Clear existing alerts

        if (!alertsArray || alertsArray.length === 0) {
            const noAlertsItem = document.createElement('li');
            noAlertsItem.className = 'alert-item'; 
            noAlertsItem.textContent = 'No new alerts.';
            alertsListEl.appendChild(noAlertsItem);
            console.log('No alerts to display.');
            return;
        }

        alertsArray.forEach(alert => {
            // Updated validation to check for transactionSignature
            if (!alert || typeof alert.tokenName === 'undefined' || 
                typeof alert.launchpadName === 'undefined' || 
                typeof alert.transactionSignature === 'undefined') {
                console.warn('Invalid alert item found (missing required fields):', alert);
                return; 
            }

            const templateClone = alertItemTemplate.content.cloneNode(true);
            const listItem = templateClone.querySelector('.alert-item'); 

            const tokenNameEl = listItem.querySelector('.token-name');
            const launchpadNameEl = listItem.querySelector('.launchpad-name');
            // Updated selector for transaction signature display element
            const transactionSignatureEl = listItem.querySelector('.transaction-signature'); 
            // Updated selector for copy button
            const copyTxSigButtonEl = listItem.querySelector('.copy-tx-sig-button');

            if (!tokenNameEl || !launchpadNameEl || !transactionSignatureEl || !copyTxSigButtonEl) {
                console.error('Elements within alert item template not found. Check template structure and class names.');
                return; 
            }

            tokenNameEl.textContent = alert.tokenName;
            launchpadNameEl.textContent = alert.launchpadName;
            // Use alert.transactionSignature to populate the element
            transactionSignatureEl.textContent = alert.transactionSignature;

            copyTxSigButtonEl.addEventListener('click', (event) => {
                const button = event.target;
                const originalButtonText = button.textContent;
                // Use alert.transactionSignature for copying, renamed variable for clarity
                const signatureToCopy = alert.transactionSignature; 

                navigator.clipboard.writeText(signatureToCopy).then(() => {
                    console.log('Transaction Signature copied to clipboard:', signatureToCopy);
                    button.textContent = 'Copied!';
                    button.disabled = true;
                    setTimeout(() => {
                        button.textContent = originalButtonText;
                        button.disabled = false;
                    }, 1500);
                }).catch(err => {
                    console.error('Failed to copy Transaction Signature:', err);
                    button.textContent = 'Failed!';
                    setTimeout(() => {
                        button.textContent = originalButtonText;
                    }, 1500);
                });
            });

            alertsListEl.appendChild(listItem);
        });
        console.log(`${alertsArray.length} alerts rendered.`);
    }

    // 4. Listen for Storage Changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            console.log('Storage changed:', changes);
            if (changes.monitoringStatus) {
                const newStatus = changes.monitoringStatus.newValue || 'Unknown';
                monitoringStatusEl.textContent = `Status: ${newStatus}`;
                console.log('Monitoring status updated in UI:', newStatus);
            }
            if (changes.alerts) {
                const newAlerts = changes.alerts.newValue || [];
                renderAlerts(newAlerts);
                console.log('Alerts updated in UI due to storage change.');
            }
        }
    });

    console.log('popup.js initialization complete.');
});