import { type ReactNode, useId } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, type PressableProps,
  ScrollView, StyleSheet, Text, TextInput, type TextInputProps, type TextProps,
  type StyleProp, View, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { fontFamilies } from './fonts';
import { useStoryTime } from './provider';

export type StoryTextProps = TextProps & {
  variant?: 'title' | 'question' | 'body' | 'caption' | 'meta';
  color?: string;
};

export function StoryText({ variant = 'body', color, style, ...props }: StoryTextProps) {
  const { theme, fontsLoaded } = useStoryTime();
  const family = variant === 'meta' ? 'meta' : variant === 'question' ? 'italic' : 'voice';
  const fallback = family === 'meta' ? Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })
    : Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
  return <Text {...props} style={[
    styles[variant],
    { color: color ?? theme.text, fontFamily: fontsLoaded ? fontFamilies[family] : fallback },
    !fontsLoaded && variant === 'question' && { fontStyle: 'italic' },
    style,
  ]} />;
}

export type StoryButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  tone?: 'primary' | 'quiet';
};

export function StoryButton({ label, loading = false, disabled, tone = 'primary', style, ...props }: StoryButtonProps) {
  const { theme } = useStoryTime();
  const primary = tone === 'primary';
  return <Pressable {...props} accessibilityRole="button" disabled={disabled || loading}
    accessibilityState={{ ...props.accessibilityState, disabled: !!disabled || loading, busy: loading }}
    style={(state) => [styles.button, {
      backgroundColor: primary ? theme.lantern : theme.panel,
      borderColor: primary ? theme.lantern : theme.line,
      opacity: disabled ? 0.45 : state.pressed ? 0.75 : 1,
    }, typeof style === 'function' ? style(state) : style]}>
    {loading && <ActivityIndicator size="small" color={primary ? theme.panel : theme.paper} />}
    <StoryText variant="meta" color={primary ? theme.panel : theme.paper} style={styles.buttonLabel}>{label}</StoryText>
  </Pressable>;
}

export type StoryScreenProps = {
  children: ReactNode;
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function StoryScreen({ children, scrollable = true, keyboardAvoiding = true,
  keyboardVerticalOffset = 0, edges = ['top', 'bottom', 'left', 'right'], style, contentStyle }: StoryScreenProps) {
  const { theme } = useStoryTime();
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return <View style={[styles.screen, { backgroundColor: theme.skyTop }, style]}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {theme.skyBands.map((color, index) => <View key={index} style={{ flex: 1, backgroundColor: color }} />)}
    </View>
    <View pointerEvents="none" style={[styles.hill, { backgroundColor: theme.hillFar }]} />
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.screenScrim }]} />
    <SafeAreaView edges={edges} style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} enabled={keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={keyboardVerticalOffset}>
        {scrollable ? <ScrollView contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

export type StoryFieldProps = TextInputProps & { label: string; error?: string };

export function StoryField({ label, error, style, ...props }: StoryFieldProps) {
  const { theme, fontsLoaded } = useStoryTime();
  const id = useId();
  return <View style={styles.fieldGroup}>
    <StoryText variant="meta">{label}</StoryText>
    <TextInput {...props} accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityHint={error ?? props.accessibilityHint} aria-describedby={error ? id : undefined}
      placeholderTextColor={theme.muted} selectionColor={theme.lantern}
      style={[styles.input, { color: theme.paper, borderColor: error ? theme.lantern : theme.line,
        backgroundColor: theme.panel, fontFamily: fontsLoaded ? fontFamilies.voice : undefined }, style]} />
    {!!error && <StoryText nativeID={id} accessibilityRole="alert" variant="caption">{error}</StoryText>}
  </View>;
}

export type ScreenStateProps = {
  status: 'loading' | 'error' | 'empty';
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function ScreenState({ status, title, message, onRetry }: ScreenStateProps) {
  const { theme } = useStoryTime();
  return <View accessibilityLiveRegion="polite" style={styles.state}>
    {status === 'loading' && <ActivityIndicator color={theme.text} accessibilityLabel="Loading" />}
    <StoryText variant="title" accessibilityRole={status === 'error' ? 'alert' : 'header'}>{title}</StoryText>
    {!!message && <StoryText>{message}</StoryText>}
    {status === 'error' && onRetry && <StoryButton label="Try again" onPress={onRetry} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hill: { position: 'absolute', width: '160%', height: '40%', left: '-30%', bottom: '-16%', borderTopLeftRadius: 400, borderTopRightRadius: 500 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: 24, gap: 24 },
  title: { fontSize: 34, lineHeight: 39, letterSpacing: -0.5 },
  question: { fontSize: 32, lineHeight: 38, letterSpacing: -0.3 },
  body: { fontSize: 20, lineHeight: 28 },
  caption: { fontSize: 16, lineHeight: 23 },
  meta: { fontSize: 11, lineHeight: 17, letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  buttonLabel: { textAlign: 'center', flexShrink: 1 },
  fieldGroup: { gap: 8 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, lineHeight: 26 },
  state: { gap: 16, paddingVertical: 32 },
});
