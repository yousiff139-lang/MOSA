import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, FlatList, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import { encode } from 'base-64';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as IntentLauncher from 'expo-intent-launcher';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

// Configure Notifications to show alerts even when app is active
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    // In a real app, we'd fetch pending notifications or ping the server to keep socket alive
    console.log("Background fetch executed! Keeping app alive...");
    // Local Notification generation example for background tests
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const manager = new BleManager();

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID_RX = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

export default function App() {
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isProvisioned, setIsProvisioned] = useState(false);
  
  // Credentials Form
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [mqttServer, setMqttServer] = useState('192.168.1.100');

  useEffect(() => {
    checkProvisionStatus();
    const subscription = manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        scanAndConnect();
        subscription.remove();
      }
    }, true);

    registerBackgroundFetch();
    checkXiaomiAutoStart();

    return () => manager.destroy();
  }, []);

  const checkProvisionStatus = async () => {
    try {
      const serverIp = await AsyncStorage.getItem('@server_ip');
      if (serverIp) {
        setMqttServer(serverIp);
        setIsProvisioned(true);
        setupSocketConnection(serverIp);
      }
    } catch (e) {
      console.log('No server IP found');
    }
  };

  const setupSocketConnection = (ip) => {
    const socket = io(`http://${ip}:3000`);
    socket.on('local_notification', async (payload) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title || "MOSA Alert",
          body: payload.message,
          data: { type: payload.type },
        },
        trigger: null, // show immediately
      });
    });
  };

  const registerBackgroundFetch = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Failed to get push token for push notification!');
        return;
      }

      await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false, // Android only
        startOnBoot: true,      // Android only
      });
      console.log("Background fetch & Notifications registered");
    } catch (err) {
      console.log("Background fetch failed to register:", err);
    }
  };

  const checkXiaomiAutoStart = () => {
    // In a real app, you'd use 'expo-device' to check if Device.manufacturer === 'Xiaomi'
    // Here we just mock the prompt for demonstration purposes based on Platform
    if (Platform.OS === 'android') {
      Alert.alert(
        "تنبيه كابوس البطارية (MIUI)",
        "لضمان وصول إشعارات الحريق والأمان لحظياً، الرجاء تفعيل (التشغيل التلقائي) وإلغاء قيود البطارية لهذا التطبيق.",
        [
          { text: "تجاهل", style: "cancel" },
          { 
            text: "تفعيل الآن", 
            onPress: () => {
              // Open MIUI AutoStart settings directly via Intent
              IntentLauncher.startActivityAsync('miui.intent.action.APP_PERM_EDITOR', {
                extra: { 'extra_pkgname': 'com.mosa.smart' }
              }).catch(() => {
                // Fallback to app settings
                IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS);
              });
            } 
          }
        ]
      );
    }
  };

  const scanAndConnect = () => {
    setIsScanning(true);
    setDevices([]);
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setIsScanning(false);
        return;
      }
      
      if (device.name && device.name.startsWith('MOSA-')) {
        setDevices(prev => {
          if (!prev.find(d => d.id === device.id)) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });

    // Stop scanning after 5 seconds
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);
  };

  const connectToDevice = async (device) => {
    try {
      manager.stopDeviceScan();
      setIsScanning(false);
      
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(connected);
      Alert.alert('Success', `Connected to ${device.name}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to connect to device');
    }
  };

  const sendProvisioningData = async () => {
    if (!connectedDevice) return;
    
    const payload = {
      ssid,
      password,
      mqtt_server: mqttServer,
      mqtt_user: 'mosa_device',
      mqtt_pass: 'mosa_mqtt_secret'
    };
    
    const jsonStr = JSON.stringify(payload);
    const base64Str = encode(jsonStr);

    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID_RX,
      );
      Alert.alert('Provisioned', 'Credentials sent to device!');
      setConnectedDevice(null);
      
      // Save Server IP and switch to WebView mode
      await AsyncStorage.setItem('@server_ip', mqttServer);
      setIsProvisioned(true);
      setupSocketConnection(mqttServer);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to send credentials');
    }
  };

  // If already provisioned, load the Web App via WebView
  if (isProvisioned) {
    return (
      <View style={{ flex: 1, marginTop: 40 }}>
        <WebView 
          source={{ uri: `http://${mqttServer}:3000` }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
        />
        <Button title="Reset App (Dev)" onPress={async () => {
          await AsyncStorage.removeItem('@server_ip');
          setIsProvisioned(false);
        }} color="#888" />
      </View>
    );
  }

  if (connectedDevice) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Provision {connectedDevice.name}</Text>
        <TextInput style={styles.input} placeholder="Wi-Fi SSID" value={ssid} onChangeText={setSsid} />
        <TextInput style={styles.input} placeholder="Wi-Fi Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="MQTT Server IP" value={mqttServer} onChangeText={setMqttServer} />
        
        <TouchableOpacity style={styles.button} onPress={sendProvisioningData}>
          <Text style={styles.buttonText}>Send to Device</Text>
        </TouchableOpacity>
        
        <Button title="Cancel" onPress={() => setConnectedDevice(null)} color="red" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MOSA Setup Wizard</Text>
      <Button title={isScanning ? "Scanning..." : "Scan for Devices"} onPress={scanAndConnect} disabled={isScanning} />
      
      <FlatList
        data={devices}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => connectToDevice(item)}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Text style={styles.deviceId}>{item.id}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f5f5f5', marginTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  button: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  deviceItem: { padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  deviceName: { fontSize: 18, fontWeight: 'bold' },
  deviceId: { fontSize: 12, color: '#666', marginTop: 5 }
});
