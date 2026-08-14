module.exports = {
  Platform: { OS: 'ios', select: (obj) => obj.ios || obj.default },
  StyleSheet: { create: (obj) => obj, flatten: (arr) => Object.assign({}, ...[].concat(arr)) },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  useColorScheme: () => 'dark',
  Animated: {
    View: 'Animated.View',
    Text: 'Animated.Text',
    ScrollView: 'Animated.ScrollView',
    Image: 'Animated.Image',
    Value: class {
      constructor(v) { this.value = v; }
      interpolate() { return 0; }
      setValue(v) { this.value = v; }
    },
    ValueXY: class {
      constructor(v) { this.x = 0; this.y = 0; }
      setValue(v) {}
    },
    timing: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    parallel: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    sequence: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    stagger: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    loop: () => ({ start: () => {}, stop: () => {} }),
    spring: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    decay: () => ({ start: (cb) => { if (cb) cb({ finished: true }); } }),
    event: () => () => {},
    createAnimatedComponent: (c) => c,
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  FlatList: 'FlatList',
  TouchableOpacity: 'TouchableOpacity',
  Pressable: 'Pressable',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  ScrollView: 'ScrollView',
  StatusBar: 'StatusBar',
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
  DeviceEventEmitter: { addListener: () => ({ remove: () => {} }), emit: () => {} },
  Keyboard: { addListener: () => ({ remove: () => {} }), dismiss: () => {} },
  Linking: { openURL: () => Promise.resolve() },
  BackHandler: { addEventListener: () => ({ remove: () => {} }) },
};
