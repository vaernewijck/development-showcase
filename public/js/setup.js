fetch('/api/ip')
  .then(r => r.json())
  .then(data => {
    const base = `http://${data.ip}:${data.port}`;
    const controllerUrl = `${base}/controller.html`;

    document.getElementById('url-controller').textContent = controllerUrl;
    document.getElementById('qr-controller').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(controllerUrl)}`;
    document.getElementById('link-controller').href = controllerUrl;

    // 3 displays with different offsets, Display 1 is master
    for (let i = 1; i <= 3; i++) {
      const masterParam = i === 1 ? '&master=true' : '';
      const displayUrl = `${base}/display.html?offset=${i - 1}${masterParam}`;
      document.getElementById(`url-display-${i}`).textContent = displayUrl;
      document.getElementById(`qr-display-${i}`).src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(displayUrl)}`;
      document.getElementById(`link-display-${i}`).href = displayUrl;
    }
  });
