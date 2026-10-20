import { AppRegistry, LogBox } from 'react-native';
import App from './App';

LogBox.ignoreAllLogs();

AppRegistry.registerComponent('PondFishCustomer', () => App);
