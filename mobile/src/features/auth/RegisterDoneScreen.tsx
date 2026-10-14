import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/app/navigation/types';
import { AppText, AuthLayout, Button } from '@/components';

type Props = NativeStackScreenProps<AuthStackParamList, 'RegisterDone'>;

export function RegisterDoneScreen({ navigation }: Props) {
  return (
    <AuthLayout title="Registration received" subtitle="Thank you for registering.">
      {/* Identical for new and already-registered emails: the API never reveals which. */}
      <AppText>
        Your organization needs to approve your account before you can sign in. We will email you
        when it is active.
      </AppText>
      <AppText muted>
        If you already had an account with this email, check your inbox: you can sign in or reset
        your password instead.
      </AppText>
      <Button title="Back to sign in" onPress={() => navigation.popToTop()} />
    </AuthLayout>
  );
}
