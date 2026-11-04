jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

global.IS_REACT_ACT_ENVIRONMENT = true;
