import { useCallback, useState } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNExitApp from 'react-native-exit-app';

export const useExitAppConfirmation = () => {
  const [showExitModal, setShowExitModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        setShowExitModal(true);
        return true; // Prevent default behavior (exiting the app immediately)
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );

      return () => backHandler.remove();
    }, [])
  );

  const handleExit = () => {
    try {
      RNExitApp.exitApp();
    } catch (error) {
      BackHandler.exitApp();
    }
  };

  return { showExitModal, setShowExitModal, handleExit };
};
