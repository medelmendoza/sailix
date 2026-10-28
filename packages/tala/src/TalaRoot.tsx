import { Pressable, Text, View } from 'react-native';
import type { TalaHost } from './host';

export function TalaRoot({ host }: { host: TalaHost }) {
  return (
    <View style={{ flex: 1, backgroundColor: host.theme.background, padding: 16 }}>
      <Text style={{ color: host.theme.text, fontSize: 20 }}>Tala package</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={host.onExit}>
        <Text style={{ color: host.theme.primary }}>Back</Text>
      </Pressable>
    </View>
  );
}
