import QRCode from 'qrcode';
import { createPayNowPayload, normalizeMobile } from '../process/paynow.mjs';

export function paymentDialogMarkup() {
  return `<dialog id="paymentDialog" class="group-dialog payment-dialog" aria-labelledby="paymentTitle">
    <div class="payment-dialog-body">
      <button id="closePayment" class="compact-button close-payment" type="button">Close</button>
      <p class="step-label">PayNow QR · Beta</p>
      <h2 id="paymentTitle">Scan. Check. Settle.</h2>
      <p id="paymentDetails"></p>
      <canvas id="paymentCanvas" role="img" aria-label="PayNow payment QR code" hidden></canvas>
      <p id="qrStatus" role="status"></p>
      <p class="qr-instructions">Scan using your banking app’s PayNow scanner. On the same phone, save this QR and import it from photos if your app supports it.</p>
      <p class="qr-check">Check the recipient name and SGD amount in your banking app before confirming. Bank compatibility is still being tested. Creating or sharing a QR does not make a payment.</p>
      <div class="qr-actions">
        <button id="downloadQr" class="primary-button" type="button" disabled>Download QR</button>
        <button id="shareQr" class="secondary-button" type="button" disabled>Share QR</button>
        <button id="copyMobile" class="secondary-button" type="button">Copy number</button>
        <button id="copyAmount" class="secondary-button" type="button">Copy amount</button>
      </div>
    </div>
  </dialog>`;
}

export function setupPaymentDialog() {
  const dialog = document.getElementById('paymentDialog');
  const canvas = document.getElementById('paymentCanvas');
  const status = document.getElementById('qrStatus');
  const download = document.getElementById('downloadQr');
  const share = document.getElementById('shareQr');
  let current = null;
  let generation = 0;
  document.getElementById('closePayment').addEventListener('click', () => dialog.close());

  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = 'Copied!';
    } catch {
      status.textContent = `Copy this: ${value}`;
    }
  }

  document.getElementById('copyMobile').addEventListener('click', () => { if (current) copy(current.mobile); });
  document.getElementById('copyAmount').addEventListener('click', () => { if (current) copy(current.amount.toFixed(2)); });
  download.addEventListener('click', () => {
    if (!current || download.disabled) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    // No phone number or player name in the filename.
    link.download = `settle-paynow-${current.amount.toFixed(2)}.png`;
    link.click();
    status.textContent = 'QR saved. Open your banking app to scan or import it.';
  });

  share.addEventListener('click', async () => {
    if (!current || share.disabled) return;
    const payment = { ...current };
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not prepare the QR image.');
      const file = new File([blob], 'settle-paynow.png', { type: 'image/png' });
      if (!navigator.canShare?.({ files: [file] })) {
        status.textContent = 'File sharing is unavailable here. Download the QR and send it in your group chat.';
        return;
      }
      await navigator.share({ files: [file], title: 'Settle payment QR', text: `Pay ${payment.name} SGD ${payment.amount.toFixed(2)}. Check the bank-displayed recipient before paying.` });
      status.textContent = 'QR shared. Payment still needs confirmation in the banking app.';
    } catch (error) {
      if (error.name !== 'AbortError') status.textContent = 'Could not share here. Download the QR instead.';
    }
  });

  return async function showPayment(payment, recipient) {
    const request = ++generation;
    current = null;
    canvas.hidden = true;
    download.disabled = true;
    share.disabled = true;
    status.textContent = 'Preparing QR…';
    dialog.showModal();
    try {
      const mobile = normalizeMobile(recipient.mobile);
      const payload = createPayNowPayload({ mobile, amount: payment.amount });
      current = { mobile, amount: payment.amount, name: recipient.player };
      document.getElementById('paymentDetails').textContent = `${payment.from} → ${recipient.player} · SGD ${payment.amount.toFixed(2)} · ${mobile}`;
      const qr = document.createElement('canvas');
      await QRCode.toCanvas(qr, payload, { width: 600, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      if (request !== generation) return;
      canvas.width = 640;
      canvas.height = 790;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.textAlign = 'center';
      context.fillStyle = '#10251f';
      context.font = 'bold 26px sans-serif';
      context.fillText(`PayNow · SGD ${payment.amount.toFixed(2)}`, 320, 40);
      context.font = '20px sans-serif';
      context.fillText(`To ${recipient.player}`, 320, 72, 580);
      context.drawImage(qr, 20, 90);
      context.fillText(mobile, 320, 715);
      context.font = '16px sans-serif';
      context.fillText('Check recipient and amount in your banking app.', 320, 748);
      context.fillText('Settle · Payment QR beta', 320, 775);
      canvas.hidden = false;
      download.disabled = false;
      share.disabled = false;
      status.textContent = '';
    } catch {
      status.textContent = 'Unable to generate this QR. Go back and check the PayNow number and amount.';
    }
  };
}
