import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Pressable, View, Platform } from 'react-native';
import { colors } from '../theme/tokens';
import { useDeviceProfile } from '../platform/device';
import { useFocusManager } from './FocusContext';

/**
 * Componente focável enterprise para Web / Smart TV / D-pad.
 */
export default function Focusable({
  id: idProp,
  children,
  onPress,
  onBack,
  style,
  focusedStyle,
  disabled = false,
  autoFocus = false,
  accessibilityLabel,
  onHoverIn: onHoverInProp,
  onHoverOut: onHoverOutProp,
}) {
  const reactId = useId();
  const id = idProp || `focus-${reactId}`;
  const ref = useRef(null);
  const { isTV, remoteFriendly, focusScale } = useDeviceProfile();
  const { focusedId, register, focus } = useFocusManager();
  const [layout, setLayout] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const isFocused = focusedId === id;

  useEffect(() => {
    return register(id, {
      ...layout,
      enabled: !disabled,
      onSelect: onPress,
      onBack,
      onFocus: () => {},
      onBlur: () => {},
      onScrollIntoView: () => {
        if (Platform.OS === 'web' && ref.current?.scrollIntoView) {
          ref.current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
      },
    });
  }, [disabled, id, layout, onBack, onPress, register]);

  useEffect(() => {
    if (autoFocus) focus(id);
  }, [autoFocus, focus, id]);

  const onLayout = useCallback((event) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    // Posição absoluta aproximada via measureInWindow quando disponível
    if (ref.current?.measureInWindow) {
      ref.current.measureInWindow((wx, wy, ww, wh) => {
        setLayout({ x: wx, y: wy, w: ww || width, h: wh || height });
      });
    } else {
      setLayout({ x, y, w: width, h: height });
    }
  }, []);

  const ring = isFocused
    ? {
        borderWidth: isTV ? 3 : 2,
        borderColor: colors.text,
        transform: [{ scale: focusScale }],
        shadowColor: colors.text,
        shadowOpacity: 0.35,
        shadowRadius: isTV ? 16 : 10,
        shadowOffset: { width: 0, height: 0 },
        zIndex: 5,
      }
    : {};

  return (
    <Pressable
      ref={ref}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => remoteFriendly && focus(id)}
      onHoverIn={() => {
        if (remoteFriendly) focus(id);
        onHoverInProp?.();
      }}
      onHoverOut={() => {
        onHoverOutProp?.();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isFocused, disabled }}
      focusable={remoteFriendly}
      onLayout={onLayout}
      style={[style, ring, isFocused ? focusedStyle : null]}
    >
      {typeof children === 'function' ? children({ focused: isFocused, isTV }) : children}
      {isFocused && isTV ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: -2,
            right: -2,
            top: -2,
            bottom: -2,
            borderWidth: 2,
            borderColor: colors.gold,
            borderRadius: 6,
          }}
        />
      ) : null}
    </Pressable>
  );
}
