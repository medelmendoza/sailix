import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { AppStackParamList } from '@/app/navigation/types';
import { AppText, Button, FormError, Notice } from '@/components';
import { colors, minTouchTarget, radius, spacing } from '@/constants/theme';
import { addPages, MAX_PAGES, movePage, removePage, roomLeft, type Page } from './pages';
import { buildPdf, discard } from './scan';
import { useScanStore } from './scanStore';

type Props = NativeStackScreenProps<AppStackParamList, 'Scanner'>;

let counter = 0;
const newId = () => `p${Date.now()}-${counter++}`;

/**
 * Scans a document into one PDF: take up to five pictures with the camera or pick them from the library, put them in
 * order, make the PDF. The PDF goes back to the form that asked; the pictures are deleted. Works without the camera.
 */
export function ScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const put = useScanStore((s) => s.put);
  const [pages, setPages] = useState<Page[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(true);

  async function shoot() {
    if (!camera.current || roomLeft(pages) === 0 || busy) return;
    setBusy('photo');
    setError(null);
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8 });
      setPages((cur) => addPages(cur, [pic.uri], newId));
    } catch {
      setError('The picture could not be taken. Try again.');
    } finally {
      setBusy(null);
    }
  }

  async function fromLibrary() {
    if (roomLeft(pages) === 0) return;
    setError(null);
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: roomLeft(pages),
        quality: 0.9,
      });
      if (!r.canceled)
        setPages((cur) =>
          addPages(
            cur,
            r.assets.map((a) => a.uri),
            newId,
          ),
        );
    } catch {
      setError('The photos could not be opened.');
    }
  }

  async function makePdf() {
    if (pages.length === 0 || busy) return;
    setBusy('pdf');
    setError(null);
    try {
      put(await buildPdf(pages));
      navigation.goBack();
    } catch {
      setError('The PDF could not be made. Try again, or use fewer pages.');
      setBusy(null);
    }
  }

  function cancel() {
    discard(pages.map((p) => p.uri));
    navigation.goBack();
  }

  const needPermission = useCamera && !permission?.granted;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FormError message={error} />

      {useCamera && permission?.granted ? (
        <View style={styles.preview}>
          <CameraView
            ref={camera}
            facing="back"
            style={StyleSheet.absoluteFill}
            onCameraReady={() => setReady(true)}
          />
        </View>
      ) : null}

      {needPermission ? (
        <View style={styles.gate}>
          <AppText variant="heading" accessibilityRole="header">
            Scan with the camera
          </AppText>
          {permission && !permission.canAskAgain ? (
            <>
              <AppText muted>
                Camera access is off for Sailix. You can turn it on in Settings, or choose photos
                from your library instead.
              </AppText>
              <Button title="Open Settings" onPress={() => void Linking.openSettings()} />
            </>
          ) : (
            <>
              <AppText muted>
                Sailix needs the camera to scan your document. The pictures stay on your phone until
                you send the PDF.
              </AppText>
              <Button title="Allow the camera" onPress={() => void requestPermission()} />
            </>
          )}
          <Button
            title="Use my photo library instead"
            variant="secondary"
            onPress={() => setUseCamera(false)}
          />
        </View>
      ) : null}

      {!useCamera ? (
        <Notice message="Choose photos of your document from the library, up to five pages." />
      ) : null}

      <View style={styles.actions}>
        {useCamera && permission?.granted ? (
          <Button
            title={roomLeft(pages) === 0 ? 'Five pages is the most' : 'Take a picture'}
            disabled={!ready || roomLeft(pages) === 0}
            loading={busy === 'photo'}
            onPress={() => void shoot()}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          title="From my library"
          variant="secondary"
          disabled={roomLeft(pages) === 0}
          onPress={() => void fromLibrary()}
          style={{ flex: 1 }}
        />
      </View>

      <AppText variant="caption" muted accessibilityLiveRegion="polite">
        {pages.length === 0
          ? `No pages yet. A scan can have up to ${MAX_PAGES}.`
          : `${pages.length} of ${MAX_PAGES} pages`}
      </AppText>

      {pages.map((p, i) => (
        <View key={p.id} style={styles.page} accessible accessibilityLabel={`Page ${i + 1}`}>
          <Image source={{ uri: p.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
          <View style={styles.pageTools}>
            <AppText variant="heading">Page {i + 1}</AppText>
            <View style={styles.row}>
              <Tool
                label={`Move page ${i + 1} earlier`}
                text="Earlier"
                disabled={i === 0}
                onPress={() => setPages((c) => movePage(c, p.id, -1))}
              />
              <Tool
                label={`Move page ${i + 1} later`}
                text="Later"
                disabled={i === pages.length - 1}
                onPress={() => setPages((c) => movePage(c, p.id, 1))}
              />
              <Tool
                label={`Remove page ${i + 1}`}
                text="Remove"
                onPress={() => {
                  discard([p.uri]);
                  setPages((c) => removePage(c, p.id));
                }}
              />
            </View>
          </View>
        </View>
      ))}

      <Button
        title={
          busy === 'pdf'
            ? 'Making the PDF…'
            : `Make a PDF of ${pages.length || 'the'} page${pages.length === 1 ? '' : 's'}`
        }
        disabled={pages.length === 0}
        loading={busy === 'pdf'}
        onPress={() => void makePdf()}
      />
      <Button title="Cancel" variant="secondary" onPress={cancel} />
    </ScrollView>
  );
}

function Tool({
  label,
  text,
  onPress,
  disabled,
}: {
  label: string;
  text: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, disabled && { opacity: 0.4 }]}
    >
      <AppText variant="caption">{text}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  preview: { height: 340, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  gate: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  page: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 84, height: 112, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  pageTools: { flex: 1, gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tool: {
    minHeight: minTouchTarget,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
