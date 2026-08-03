let currentListener = null;

const NetInfoMock = {
  addEventListener: (callback) => {
    currentListener = callback;
    return () => {
      currentListener = null;
    };
  },
  fetch: async () => ({ isConnected: true, isInternetReachable: true }),
  __triggerChange: (state) => {
    if (currentListener) {
      currentListener(state);
    }
  },
};

module.exports = NetInfoMock;
module.exports.default = NetInfoMock;
