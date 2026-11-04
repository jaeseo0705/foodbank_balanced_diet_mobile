# 영양성분 입력 모바일 앱

의료사회복지론 웹앱 프로젝트의 FMS 영양성분 입력용 모바일 앱입니다. React Native와 Expo를 사용해 iOS와 Android에서 같은 화면을 실행합니다.

## 현재 구현

- 제공된 화면을 기준으로 흰 배경, 영양정보 스캔 일러스트, 아이디·비밀번호 입력란, 비밀번호 표시 버튼, 로그인 상태 유지 체크박스, 로그인 버튼, 계정 찾기 안내를 구현했습니다.
- 아이디와 비밀번호를 입력하지 않아도 로그인 버튼을 누르면 흰색 빈 화면으로 이동합니다. 비밀번호 입력 후 키보드의 이동 버튼으로도 진입할 수 있습니다.
- 로그인 상태와 입력값은 메모리에만 있습니다. 앱을 완전히 종료한 후 새로 실행하면 항상 로그인 화면으로 돌아옵니다. 단순히 다른 앱으로 전환했다가 복귀하면 현재 화면을 유지합니다.
- ‘로그인 상태 유지’는 화면에 맞춰 기본 선택되며 선택을 바꿀 수 있습니다. 이번 버전에서는 체크 여부와 관계없이 완전 종료 후 로그인 상태를 복원하지 않습니다.
- 아이디·비밀번호 찾기를 누르면 현재 계정 없이 이용할 수 있다는 안내를 표시합니다.
- 태블릿에서는 로그인 폼을 가운데에 표시하며, 작은 화면과 키보드가 열린 상태에서는 스크롤할 수 있습니다.

아직 실제 인증, 카메라, OCR, FMS 데이터 연동은 연결하지 않았습니다. 실제 계정 정보는 필요하지 않습니다.

## 맥북에서 실행

Node.js 22.13 이상(LTS 권장)을 설치한 뒤 터미널에서 실행합니다.

```bash
git clone https://github.com/jaeseo0705/foodbank_balanced_diet_mobile.git
cd foodbank_balanced_diet_mobile
npm install
npm start
```

이번 구성은 공식 Expo 안내의 실기기 Expo Go 권장 버전에 맞춘 SDK 57입니다. 휴대기기 Expo Go가 지원하는 SDK 버전과 맞아야 합니다.

- **갤럭시 태블릿:** Expo Go를 설치하고, 맥북과 같은 Wi-Fi에 연결한 뒤 터미널 QR 코드를 Expo Go로 스캔합니다.
- **iOS 시뮬레이터:** 맥북에 Xcode와 iOS 시뮬레이터를 설치한 상태에서 `npm run ios`를 실행합니다.
- **Android 에뮬레이터:** Android Studio에서 가상 기기를 실행한 뒤 `npm run android`를 실행합니다.
- **브라우저에서 화면 확인:** `npm run web`을 실행합니다. 새로고침하면 로그인 화면으로 돌아옵니다. 모바일 최종 확인은 기기 또는 시뮬레이터에서 진행합니다.

개발 중 Expo Go를 쓰는 경우 앱을 ‘완전히 종료’하려면 Expo Go 자체를 종료한 후 프로젝트를 다시 여세요. Fast Refresh는 상태를 유지할 수 있으므로 종료·재실행 확인에는 사용하지 마세요.

## 검증

```bash
npm run typecheck
npm test
npx expo install --check
npm run export
```

GitHub Actions에서도 의존성 호환성, 타입 검사, 로그인·비밀번호 표시·재실행 동작 테스트, iOS·Android·웹 번들 생성을 실행합니다. 번들 생성은 설치 가능한 APK/IPA 생성이나 실기기 실행 검증과는 별도입니다.

## 주요 파일

- `App.tsx`: 메모리에서만 유지되는 로그인 화면/빈 화면 전환
- `src/screens/LoginScreen.tsx`: 로그인 화면과 입력 상태
- `src/components/NutritionIllustration.tsx`: 영양정보 스캔 일러스트
- `src/components/Icons.tsx`: 눈 아이콘과 체크 표시
- `__tests__/App.test.jsx`: 로그인과 종료 후 초기화 동작 검증

## 참고

- [Expo 프로젝트 시작 안내](https://docs.expo.dev/get-started/create-a-project/)
- [Expo SDK 버전 호환성](https://docs.expo.dev/versions/latest/)
