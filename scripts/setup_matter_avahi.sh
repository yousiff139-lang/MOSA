#!/bin/bash
set -e

echo "========================================================="
echo " Configuring Avahi mDNS for Apple HomeKit & Matter 1.3"
echo "========================================================="

# 1. Ensure UFW firewall allows mDNS (5353/udp) and Matter commissioning (5540/udp)
if command -v ufw >/dev/null 2>&1; then
  echo "Opening firewall ports 5353/udp, 5540/udp, and 51826/tcp..."
  sudo ufw allow 5353/udp >/dev/null 2>&1 || true
  sudo ufw allow 5540/udp >/dev/null 2>&1 || true
  sudo ufw allow 51826/tcp >/dev/null 2>&1 || true
fi

# 2. Configure /etc/avahi/avahi-daemon.conf
# Enable reflector so dynamic operational Matter announcements (_matter._tcp) cross from Docker to WiFi
if [ -f /etc/avahi/avahi-daemon.conf ]; then
  echo "Enabling mDNS reflector in /etc/avahi/avahi-daemon.conf..."
  sudo sed -i '/deny-interfaces=/d' /etc/avahi/avahi-daemon.conf
  sudo sed -i 's/#enable-reflector=no/enable-reflector=yes/' /etc/avahi/avahi-daemon.conf
  sudo sed -i 's/enable-reflector=no/enable-reflector=yes/' /etc/avahi/avahi-daemon.conf
  sudo sed -i 's/#use-ipv4=yes/use-ipv4=yes/' /etc/avahi/avahi-daemon.conf
fi

# 3. Create the CSA Matter 1.3 specification-compliant Avahi service
cat << 'EOF' | sudo tee /etc/avahi/services/matter.service > /dev/null
<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name>B2D7F41924968AD0</name>
  <service>
    <type>_matterc._udp</type>
    <subtype>_L3840._sub._matterc._udp</subtype>
    <subtype>_S15._sub._matterc._udp</subtype>
    <subtype>_CM._sub._matterc._udp</subtype>
    <subtype>_V65521._sub._matterc._udp</subtype>
    <port>5540</port>
    <txt-record>D=3840</txt-record>
    <txt-record>CM=1</txt-record>
    <txt-record>VP=65521+32768</txt-record>
    <txt-record>DN=MOSA Smart Platform</txt-record>
    <txt-record>SII=500</txt-record>
    <txt-record>SAI=300</txt-record>
    <txt-record>SAT=4000</txt-record>
    <txt-record>PH=33</txt-record>
    <txt-record>T=0</txt-record>
    <txt-record>DT=266</txt-record>
    <txt-record>ICD=0</txt-record>
  </service>
</service-group>
EOF

# 4. Set directory permissions so Docker backend can dynamically sync mDNS services
sudo chmod 777 /etc/avahi/services
sudo chmod 666 /etc/avahi/services/*.service 2>/dev/null || true

# 5. Restart avahi-daemon
if command -v systemctl >/dev/null 2>&1; then
  echo "Restarting avahi-daemon..."
  sudo systemctl restart avahi-daemon
fi

echo "========================================================="
echo "✅ Avahi Matter 1.3 mDNS broadcast is LIVE on host!"
echo "   - Instance: B2D7F41924968AD0._matterc._udp.local"
echo "   - Long Subtype:  _L3840._sub._matterc._udp.local"
echo "   - Short Subtype: _S15._sub._matterc._udp.local"
echo "   - Target Port:   5540/udp"
echo "   - Reflector:     ENABLED (Bridging Docker & WiFi)"
echo "========================================================="
