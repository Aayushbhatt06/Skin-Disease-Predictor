import React, {useEffect, useState, useRef, useMemo, useCallback} from 'react';
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Animated,
  ScrollView,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps,
} from 'react-native-vision-camera';
import {useTensorflowModel} from 'react-native-fast-tflite';
import {useResizePlugin} from 'vision-camera-resize-plugin';
import {Worklets} from 'react-native-worklets-core';

import {
  DISEASE_LABELS,
  DISEASE_INFO,
  RISK_LEVELS,
  MODEL_INPUT_SIZE,
} from './src/constants';

// ─── Dimensions & Layout ────────────────────────────────────

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');
const BOX_SIZE = SCREEN_WIDTH * 0.7;
const CORNER_SIZE = 28;
const CORNER_WIDTH = 3;

// ─── Types ──────────────────────────────────────────────────

type Prediction = {
  index: number;
  label: string;
  confidence: number;
};

// ═════════════════════════════════════════════════════════════
//  RESULT SHEET COMPONENT
// ═════════════════════════════════════════════════════════════

function ResultSheet({
  predictions,
  onScanAgain,
}: {
  predictions: Prediction[];
  onScanAgain: () => void;
}) {
  const top = predictions[0];
  if (!top) {
    return null;
  }

  const risk = RISK_LEVELS[top.label] ?? {
    level: 'Unknown',
    color: '#888',
    icon: '❓',
  };
  const info =
    DISEASE_INFO[top.label] ?? 'No additional information available for this classification.';

  // Animated confidence bars
  const barAnims = useRef(predictions.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = predictions.map((pred, i) =>
      Animated.timing(barAnims[i], {
        toValue: pred.confidence,
        duration: 800 + i * 200,
        useNativeDriver: false,
      }),
    );
    Animated.stagger(150, anims).start();
  }, [predictions, barAnims]);

  const BAR_COLORS = ['#00E5A0', '#00BFFF', '#8B5CF6'];

  return (
    <ScrollView
      style={styles.resultScrollView}
      contentContainerStyle={styles.resultContent}
      showsVerticalScrollIndicator={false}>
      {/* Sheet handle */}
      <View style={styles.sheetHandle} />

      <Text style={styles.resultTitle}>Scan Results</Text>

      {/* ── Main result card ── */}
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultEmoji}>🏥</Text>
          <View style={styles.resultHeaderText}>
            <Text style={styles.resultLabel}>{top.label}</Text>
            <View
              style={[
                styles.riskBadge,
                {backgroundColor: risk.color + '20'},
              ]}>
              <Text style={styles.riskIcon}>{risk.icon}</Text>
              <Text style={[styles.riskText, {color: risk.color}]}>
                {risk.level} Risk
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceValue}>
            {(top.confidence * 100).toFixed(1)}
            <Text style={styles.confidencePercent}>%</Text>
          </Text>
          <Text style={styles.confidenceLabel}>CONFIDENCE</Text>
        </View>
      </View>

      {/* ── Top predictions ── */}
      <View style={styles.predSection}>
        <Text style={styles.predSectionTitle}>Top Predictions</Text>

        {predictions.map((pred, i) => (
          <View key={`pred-${pred.index}`} style={styles.predRow}>
            <View style={styles.predInfo}>
              <Text style={styles.predRank}>#{i + 1}</Text>
              <Text style={styles.predName} numberOfLines={1}>
                {pred.label}
              </Text>
              <Text style={styles.predConf}>
                {(pred.confidence * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.predBarBg}>
              <Animated.View
                style={[
                  styles.predBarFill,
                  {
                    width: barAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: BAR_COLORS[i] ?? '#666',
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* ── Condition info ── */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ About this condition</Text>
        <Text style={styles.infoText}>{info}</Text>
      </View>

      {/* ── Scan Again button ── */}
      <TouchableOpacity
        style={styles.scanAgainButton}
        onPress={onScanAgain}
        activeOpacity={0.8}>
        <Text style={styles.scanAgainText}>🔄 Scan Again</Text>
      </TouchableOpacity>

      {/* ── Disclaimer ── */}
      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerTitle}>⚕️ Medical Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          This app is for educational purposes only and is not a substitute for
          professional medical advice, diagnosis, or treatment. Always seek the
          advice of a qualified healthcare provider with any questions regarding
          a medical condition.
        </Text>
      </View>
    </ScrollView>
  );
}

// ═════════════════════════════════════════════════════════════
//  MAIN APP COMPONENT
// ═════════════════════════════════════════════════════════════

export default function App() {
  // ─── Camera & permissions ─────────────────────────────────
  const {hasPermission, requestPermission} = useCameraPermission();
  const device = useCameraDevice('back');

  // ─── Model ────────────────────────────────────────────────
  const tfModel = useTensorflowModel(
    require('./android/app/src/main/assets/model.tflite'),
  );
  const model = tfModel.state === 'loaded' ? tfModel.model : undefined;

  // ─── Resize plugin ────────────────────────────────────────
  const {resize} = useResizePlugin();

  // ─── State ────────────────────────────────────────────────
  const [livePrediction, setLivePrediction] = useState<Prediction | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [capturedResult, setCapturedResult] = useState<Prediction[]>([]);

  // ─── Refs ─────────────────────────────────────────────────
  const latestTop3 = useRef<Prediction[]>([]);

  // ─── Animations ───────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // ─── Effects ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Scan button pulse
  useEffect(() => {
    if (model && !showResult) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [model, showResult, pulseAnim]);

  // Scan line sweep
  useEffect(() => {
    if (model && !showResult) {
      const sweep = Animated.loop(
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
      );
      sweep.start();
      return () => sweep.stop();
    }
  }, [model, showResult, scanLineAnim]);

  // ─── Worklet → JS bridge ─────────────────────────────────
  const onClassification = useMemo(
    () =>
      Worklets.createRunOnJS(
        (
          i0: number,
          c0: number,
          i1: number,
          c1: number,
          i2: number,
          c2: number,
        ) => {
          const mkPred = (idx: number, conf: number): Prediction => ({
            index: idx,
            label: DISEASE_LABELS[idx] ?? `Class ${idx}`,
            confidence: Math.max(0, Math.min(1, conf)),
          });

          const top3 = [mkPred(i0, c0), mkPred(i1, c1), mkPred(i2, c2)];
          setLivePrediction(top3[0]);
          latestTop3.current = top3;
        },
      ),
    [],
  );

  // ─── Frame Processor ─────────────────────────────────────
  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';

      if (model == null) {
        return;
      }

      runAtTargetFps(2, () => {
        'worklet';

        try {
          // Resize frame to model input dimensions (224×224 RGB float32)
          const resized = resize(frame, {
            scale: {width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE},
            pixelFormat: 'rgb',
            dataType: 'float32',
          });

          // Run inference
          const outputs = model.runSync([resized]);
          // outputs[0] is typically a TypedArray (Float32Array or Uint8Array)
          const raw = outputs[0] as unknown as number[] | Float32Array | Uint8Array;

          // Apply softmax normalization (handles both logits and probabilities)
          let maxLogit = raw[0];
          for (let i = 1; i < raw.length; i++) {
            if (raw[i] > maxLogit) {
              maxLogit = raw[i];
            }
          }
          let sumExp = 0;
          const probs = new Float32Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            probs[i] = Math.exp(raw[i] - maxLogit);
            sumExp += probs[i];
          }
          for (let i = 0; i < probs.length; i++) {
            probs[i] /= sumExp;
          }

          // Find top-3 predictions
          let i0 = 0,
            c0 = -1;
          let i1 = 0,
            c1 = -1;
          let i2 = 0,
            c2 = -1;

          for (let i = 0; i < probs.length; i++) {
            if (probs[i] > c0) {
              c2 = c1;
              i2 = i1;
              c1 = c0;
              i1 = i0;
              c0 = probs[i];
              i0 = i;
            } else if (probs[i] > c1) {
              c2 = c1;
              i2 = i1;
              c1 = probs[i];
              i1 = i;
            } else if (probs[i] > c2) {
              c2 = probs[i];
              i2 = i;
            }
          }

          onClassification(i0, c0, i1, c1, i2, c2);
        } catch (e) {
          // Log errors to the metro console so we know if it crashes!
          console.error('Frame processor error:', e);
        }
      });
    },
    [model, resize, onClassification],
  );

  // ─── Handlers ─────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    if (latestTop3.current.length === 0) {
      return;
    }
    setCapturedResult([...latestTop3.current]);
    setShowResult(true);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 9,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const handleScanAgain = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowResult(false);
      setCapturedResult([]);
    });
  }, [slideAnim, fadeAnim]);

  // ─── Early returns ────────────────────────────────────────

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
        <View style={styles.loadingGlow} />
        <ActivityIndicator size="large" color="#00E5A0" />
        <Text style={styles.statusText}>Requesting camera permission…</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centeredContainer}>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="light-content"
        />
        <Text style={styles.errorEmoji}>📷</Text>
        <Text style={styles.statusText}>No camera found on this device</Text>
      </View>
    );
  }

  // ─── Derived values ───────────────────────────────────────
  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, BOX_SIZE],
  });

  const modelStatusColor =
    tfModel.state === 'loaded'
      ? '#2ED573'
      : tfModel.state === 'error'
        ? '#FF4757'
        : '#FFA502';

  const modelStatusText =
    tfModel.state === 'loaded'
      ? 'AI Ready'
      : tfModel.state === 'error'
        ? 'Model Error'
        : 'Loading Model…';

  // ─── Render ───────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* ── Camera preview ── */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!showResult}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />

      {/* ── Scanner overlay ── */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top dark band + title bar */}
        <View style={[styles.overlayDark, styles.topArea]}>
          <View style={styles.topBar}>
            <Text style={styles.title}>🔬 Skin Scanner</Text>
            <View
              style={[
                styles.statusBadge,
                {backgroundColor: modelStatusColor + '20'},
              ]}>
              <View
                style={[styles.statusDot, {backgroundColor: modelStatusColor}]}
              />
              <Text
                style={[styles.statusBadgeText, {color: modelStatusColor}]}>
                {modelStatusText}
              </Text>
            </View>
          </View>
        </View>

        {/* Middle row: dark | bounding box | dark */}
        <View style={styles.centerRow}>
          <View style={styles.overlayDark} />
          <View style={[styles.boundingBox, {width: BOX_SIZE, height: BOX_SIZE}]}>
            {/* Corner accents */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Animated scan line */}
            {model && !showResult && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {transform: [{translateY: scanLineTranslate}]},
                ]}
              />
            )}
          </View>
          <View style={styles.overlayDark} />
        </View>

        {/* Bottom dark band + controls */}
        <View style={[styles.overlayDark, styles.bottomArea]}>
          {/* Live prediction badge */}
          {livePrediction && model && !showResult && (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeLabel}>
                {livePrediction.label}
              </Text>
              <View style={styles.liveBadgeDivider} />
              <Text style={styles.liveBadgeConf}>
                {(livePrediction.confidence * 100).toFixed(1)}%
              </Text>
            </View>
          )}

          {/* Model loading indicator */}
          {!model && (
            <View style={styles.loadingBadge}>
              <ActivityIndicator size="small" color="#00E5A0" />
              <Text style={styles.loadingText}>Loading AI model…</Text>
            </View>
          )}

          {/* Scan button */}
          {model && !showResult && (
            <Animated.View style={{transform: [{scale: pulseAnim}]}}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleCapture}
                activeOpacity={0.8}>
                <View style={styles.scanButtonInner}>
                  <Text style={styles.scanButtonIcon}>⬡</Text>
                  <Text style={styles.scanButtonText}>SCAN</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          <Text style={styles.hintText}>
            {model
              ? '📸 Position skin area inside the box'
              : '⏳ Initializing AI engine…'}
          </Text>
        </View>
      </View>

      {/* ── Result overlay ── */}
      {showResult && (
        <>
          <Animated.View
            style={[styles.resultDimmer, {opacity: fadeAnim}]}
          />
          <Animated.View
            style={[
              styles.resultSheet,
              {transform: [{translateY: slideAnim}]},
            ]}>
            <ResultSheet
              predictions={capturedResult}
              onScanAgain={handleScanAgain}
            />
          </Animated.View>
        </>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // ─── Base containers ──────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,229,160,0.06)',
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },

  // ─── Overlay ──────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  overlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // ─── Top area ─────────────────────────────────────────────
  topArea: {
    justifyContent: 'flex-end',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: (StatusBar.currentHeight ?? 44) + 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ─── Center bounding box ─────────────────────────────────
  centerRow: {
    flexDirection: 'row',
  },
  boundingBox: {
    borderColor: '#00E5A0',
    borderWidth: 2,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#00E5A0',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00E5A0',
    shadowColor: '#00E5A0',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 5,
  },

  // ─── Bottom area ──────────────────────────────────────────
  bottomArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
    paddingTop: 20,
    gap: 16,
  },

  // ─── Live prediction badge ────────────────────────────────
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,160,0.10)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.25)',
    gap: 10,
  },
  liveBadgeLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  liveBadgeDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  liveBadgeConf: {
    color: '#00E5A0',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Loading badge ────────────────────────────────────────
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,229,160,0.15)',
  },
  loadingText: {
    color: '#00E5A0',
    fontSize: 13,
    fontWeight: '500',
  },

  // ─── Scan button ──────────────────────────────────────────
  scanButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(0,229,160,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#00E5A0',
  },
  scanButtonInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#00E5A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonIcon: {
    color: '#0A0A0F',
    fontSize: 18,
    marginBottom: -2,
  },
  scanButtonText: {
    color: '#0A0A0F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  // ─── Hint text ────────────────────────────────────────────
  hintText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },

  // ─── Result overlay ───────────────────────────────────────
  resultDimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  resultSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: '#12121A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  resultScrollView: {
    flex: 1,
  },
  resultContent: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 48,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: 0.3,
  },

  // ─── Result card ──────────────────────────────────────────
  resultCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 24,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  resultEmoji: {
    fontSize: 40,
  },
  resultHeaderText: {
    flex: 1,
    gap: 8,
  },
  resultLabel: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  riskIcon: {
    fontSize: 12,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confidenceContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  confidenceValue: {
    color: '#00E5A0',
    fontSize: 52,
    fontWeight: '800',
  },
  confidencePercent: {
    fontSize: 26,
    fontWeight: '700',
  },
  confidenceLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 4,
  },

  // ─── Predictions section ──────────────────────────────────
  predSection: {
    marginBottom: 20,
  },
  predSectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  predRow: {
    marginBottom: 14,
  },
  predInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  predRank: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    fontWeight: '700',
    width: 28,
  },
  predName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  predConf: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  predBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 28,
  },
  predBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ─── Info card ────────────────────────────────────────────
  infoCard: {
    backgroundColor: 'rgba(0,191,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,191,255,0.10)',
    marginBottom: 24,
  },
  infoTitle: {
    color: '#00BFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    lineHeight: 22,
  },

  // ─── Scan Again button ────────────────────────────────────
  scanAgainButton: {
    backgroundColor: '#00E5A0',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  scanAgainText: {
    color: '#0A0A0F',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ─── Disclaimer ───────────────────────────────────────────
  disclaimerCard: {
    backgroundColor: 'rgba(255,71,87,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.10)',
  },
  disclaimerTitle: {
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  disclaimerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    lineHeight: 18,
  },
});
