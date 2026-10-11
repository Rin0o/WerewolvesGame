import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'qrcode/lib/core/qrcode';

const QUIET_ZONE_MODULES = 2;

export default function RoomQrCode({ value, size = 180 }) {
  const rows = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    return Array.from({ length: modules.size }, (_, row) =>
      Array.from({ length: modules.size }, (_, col) => modules.data[row * modules.size + col] === 1)
    );
  }, [value]);

  const cell = Math.floor(size / (rows.length + QUIET_ZONE_MODULES * 2));
  const padding = cell * QUIET_ZONE_MODULES;

  return (
    <View style={[styles.frame, { padding }]}>
      {rows.map((cells, row) => (
        <View key={row} style={styles.row}>
          {cells.map((dark, col) => (
            <View key={col} style={{ width: cell, height: cell, backgroundColor: dark ? '#000' : '#fff' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#fff', borderRadius: 8, alignSelf: 'center' },
  row: { flexDirection: 'row' },
});
