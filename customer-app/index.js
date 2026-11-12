import { AppRegistry, LogBox, Text, TextInput, Platform } from 'react-native';
import App from './App';

LogBox.ignoreAllLogs();

// Globally set Plus Jakarta Sans as the default font for all Text and TextInput components
const defaultFont = {
  fontFamily: Platform.select({
    ios: 'Plus Jakarta Sans',
    android: 'PlusJakartaSans',
    default: 'PlusJakartaSans',
  }),
};

if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.style = defaultFont;

if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.style = defaultFont;

AppRegistry.registerComponent('PondFishCustomer', () => App);
