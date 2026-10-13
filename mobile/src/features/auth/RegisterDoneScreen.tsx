import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import type { AuthStackParamList } from '@/app/navigation/types';
import { AppText, Button, FormScreen } from '@/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterDone'>;

export function RegisterDoneScreen({ navigation }: Props) {
  return (
    <FormScreen>
      <View style={{ gap: 8 }}>
        <AppText variant="title" accessibilityRole="header">
          Registration received
        </AppText>
        {/* Identical for new and already-registered emails: the API never reveals which. */}
        <AppText>
          Your organization needs to approve your account before you can sign in. We will email you
          when it is active.
        </AppText>
        <AppText muted>
          If you already had an account with this email, check your inbox: you can sign in or reset
          your password instead.
        </AppText>
      </View>
      <Button title="Back to sign in" onPress={() => navigation.popToTop()} />
    </FormScreen>
  );
}
