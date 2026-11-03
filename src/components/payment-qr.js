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
      <p class="qr-instructions">Scan using your banking app’s PayNow scanner. On the same phone, tap Save QR and choose Save Image or Save to Photos if offered. Otherwise, download the image and import it into your banking app.</p>
      <p class="qr-check">Check the recipient name and SGD amount in your banking app before confirming. Bank compatibility is still being tested. Creating or sharing a QR does not make a payment.</p>
      <div class="qr-actions">
        <button id="saveQr" class="primary-button" type="button" disabled>Save QR</button>
        <button id="downloadQr" class="secondary-button" type="button" disabled>Download QR</button>
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
  const save = document.getElementById('saveQr');
  let current = null;
  let imageUrl = null;
  let imageFile = null;
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
  function downloadImage() {
    if (!current || !imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    // No phone number or player name in the filename.
    link.download = `settle-paynow-${current.amount.toFixed(2)}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    status.textContent = 'QR download started. Check your browser’s Downloads, then import the image into your banking app.';
  }
  download.addEventListener('click', () => { if (!download.disabled) downloadImage(); });

  save.addEventListener('click', async () => {
    if (!current || save.disabled) return;
    const request = generation;
    save.disabled = true;
    try {
      if (!imageFile || !navigator.share || !navigator.canShare?.({ files: [imageFile] })) {
        downloadImage();
        return;
      }
      // Prepare the file before the tap so opening the share sheet keeps user activation.
      // Image only: the phone chooses which photo-saving and sharing actions to offer.
      await navigator.share({ files: [imageFile] });
      if (request === generation) status.textContent = 'If offered, choose Save Image or Save to Photos. You can also use Download QR.';
    } catch (error) {
      if (request !== generation) return;
      if (error.name === 'AbortError') status.textContent = 'Save cancelled. Tap Save QR to try again, or use Download QR.';
      else downloadImage();
    } finally {
      if (request === generation) save.disabled = false;
    }
  });

  return async function showPayment(payment, recipient) {
    const request = ++generation;
    current = null;
    imageUrl = null;
    imageFile = null;
    canvas.hidden = true;
    download.disabled = true;
    save.disabled = true;
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
      const preparedUrl = canvas.toDataURL('image/png');
      let preparedFile = null;
      if (typeof File !== 'undefined') {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) preparedFile = new File([blob], 'settle-paynow.png', { type: 'image/png' });
      }
      if (request !== generation) return;
      imageUrl = preparedUrl;
      imageFile = preparedFile;
      canvas.hidden = false;
      download.disabled = false;
      save.disabled = false;
      status.textContent = '';
    } catch {
      status.textContent = 'Unable to generate this QR. Go back and check the PayNow number and amount.';
    }
  };
}
