const statusEl = document.querySelector("#status");

const updateStatus = (message, timeout = 2000) => {
  if (!statusEl) {
    return;
  }
  statusEl.textContent = message;
  if (timeout > 0) {
    setTimeout(() => {
      statusEl.textContent = "Idle";
    }, timeout);
  }
};

updateStatus("Ready", 1500);
