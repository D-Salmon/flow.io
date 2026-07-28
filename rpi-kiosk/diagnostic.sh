#!/bin/sh
set -u

echo "=== Flow.io Kiosk ==="
echo "Configuration :"
sed 's/^/  /' /etc/flowio-kiosk/config.env 2>/dev/null || true
echo
echo "Service :"
systemctl --no-pager --full status flowio-kiosk.service || true
echo
echo "Commande locale d'arret :"
systemctl --no-pager --full status flowio-kiosk-shutdown.service || true
echo
echo "Derniers journaux du kiosk :"
journalctl --no-pager -u flowio-kiosk.service -n 50 || true
echo
echo "Derniers journaux de la commande d'arret :"
journalctl --no-pager -u flowio-kiosk-shutdown.service -n 30 || true
