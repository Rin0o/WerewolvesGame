import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { roomCodeFromScan } from '../utils/roomQr';
import { FONTS, RADIUS, SPACING } from '../constants/theme';

const UNKNOWN_CODE_HINT_MS = 2500;

export default function QrScannerModal({ visible, onClose, onCodeScanned, theme: t }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [unknownCode, setUnknownCode] = useState(false);
  const handledRef = useRef(false);
  const hintTimeoutRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    handledRef.current = false;
    setUnknownCode(false);
    if (permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [visible, permission?.granted]);

  useEffect(() => () => clearTimeout(hintTimeoutRef.current), []);

  function handleScan({ data }) {
    if (handledRef.current) return;
    const code = roomCodeFromScan(data);
    if (!code) {
      setUnknownCode(true);
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = setTimeout(() => setUnknownCode(false), UNKNOWN_CODE_HINT_MS);
      return;
    }
    handledRef.current = true;
    onCodeScanned(code);
  }

  function renderBody() {
    if (!permission) {
      return <ActivityIndicator color="#fff" />;
    }
    if (!permission.granted) {
      return (
        <View style={styles.message}>
          <Text style={styles.messageText}>
            Camera access is needed to scan a room's QR code.
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: t.primary }]}
            onPress={permission.canAskAgain ? requestPermission : Linking.openSettings}
          >
            <Text style={styles.btnText}>{permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScan}
        />
        <View style={styles.frame} pointerEvents="none" />
        <Text style={styles.hint}>
          {unknownCode ? 'That QR code is not a Werewolves room.' : 'Point the camera at the room QR code in the host\'s lobby.'}
        </Text>
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>{visible && renderBody()}</View>
        <TouchableOpacity style={[styles.btn, styles.closeBtn, { borderColor: '#fff' }]} onPress={onClose}>
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  frame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.md,
  },
  hint: {
    ...FONTS.body,
    color: '#fff',
    textAlign: 'center',
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  message: { padding: SPACING.lg, alignItems: 'center' },
  messageText: { ...FONTS.body, color: '#fff', textAlign: 'center', marginBottom: SPACING.lg },
  btn: { borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, alignItems: 'center' },
  closeBtn: { margin: SPACING.lg, borderWidth: 2, backgroundColor: 'transparent' },
  btnText: { ...FONTS.button, color: '#fff' },
});
