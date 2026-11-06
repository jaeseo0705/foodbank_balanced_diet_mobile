# Foodbank Balanced Diet Mobile

React Native + Expo 기반의 푸드뱅크 업무 시연용 모바일 앱입니다.

## 현재 화면

- 로그인 버튼을 누르면 인증 없이 **업무 선택** 화면으로 이동합니다.
- 업무는 **영양성분 등록 / 재고 현황 / 배분 추천 / 영양 계산** 순서로 2열 배치합니다.
- 프로필 버튼에서 설정, 앱 정보, 로그아웃으로 이동합니다.
- 각 업무와 설정은 제목과 뒤로 가기까지 연결된 기본 화면입니다. OCR·재고 관리·추천·계산 기능은 아직 구현하지 않았습니다.
- 앱을 완전히 종료한 뒤 새로 실행하면 로그인 화면부터 시작합니다. 로그인 상태 유지 선택 여부와 관계없이 계정·로그인 상태를 저장하지 않습니다.
- 화면의 색상은 `src/theme.ts`, 업무 아이콘과 프로필은 `src/components/TaskIcons.tsx`에서 관리합니다.
- 상태 표시줄과 시각은 운영체제의 실제 표시를 사용합니다. 시안의 상태 표시줄을 이미지로 덧붙이지 않습니다.

## 맥북에서 iPhone 시뮬레이터로 실행

Xcode와 iOS 시뮬레이터, Node.js(22.13 이상, LTS 권장)가 필요합니다.

1. 터미널에서 이 프로젝트의 `package.json`이 있는 폴더로 이동합니다.
2. 처음 받았거나 의존성이 변경되었다면 `npm install`을 실행합니다.
3. `npm start`를 실행합니다.
4. **같은 터미널에서 Shift+i**를 누르고 **iPhone 18 Pro**를 선택합니다.

QR 코드는 실제 휴대전화의 Expo Go로 연결할 때 사용하는 것으로, 맥북의 시뮬레이터에서는 스캔하지 않습니다. 개발 서버가 실행 중인 터미널은 열어 둡니다. 종료하려면 Ctrl+C를 누릅니다.

### GitHub 업데이트 받기

- **git clone으로 받은 폴더**: 해당 프로젝트 폴더에서 `git pull`로 최신 코드를 받습니다.
- **Download ZIP으로 받은 폴더**: git으로 연결된 폴더가 아니므로 `git pull`은 작동하지 않습니다. 최신 ZIP을 내려받아 압축을 풀고 새 폴더에서 실행합니다.

## 검증

`npm run typecheck`, `npm test`, `npm run export`로 타입·화면 동작·iOS/Android/Web 번들을 확인합니다.
웹 브라우저 검사는 export 후 `npx playwright install chromium`, `npm run test:web`로 실행합니다(Python 3 필요).
GitHub Actions에서 같은 검사를 자동 실행하며 로그인·업무 선택 화면 캡처를 결과물에 보관합니다.
