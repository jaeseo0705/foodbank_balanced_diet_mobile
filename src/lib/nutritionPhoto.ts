import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PhotoMethod = 'camera' | 'photo';
export type PhotoResult =
  | { kind: 'picked'; asset: ImagePicker.ImagePickerAsset }
  | { kind: 'canceled' }
  | { kind: 'permission-denied'; canAskAgain: boolean };

export async function selectNutritionPhoto(method: PhotoMethod): Promise<PhotoResult> {
  if (method === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { kind: 'permission-denied', canAskAgain: permission.canAskAgain };
    }
  }

  // The system photo picker grants access to the selected image only.
  // Do not ask for full photo-library access or crop a nutrition label.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
    exif: false,
    base64: false,
  };
  const result = method === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return { kind: 'canceled' };
  const asset = result.assets?.[0];
  if (!asset?.uri || (asset.type && asset.type !== 'image')) {
    throw new Error('No image was returned by the picker');
  }
  return { kind: 'picked', asset };
}
