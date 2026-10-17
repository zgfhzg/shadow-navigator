# 그늘길 · Shadow
메인 화면에서 지역과 출발지·도착지를 검색하고, 시간대별 햇빛 노출을 비교한 경로를 실제 지도 위에 표시합니다. 흰색·블루 디자인과 하단 출발 시간 선택을 유지합니다. 별도의 엔진/API 화면으로 이동하지 않습니다.

## 실행
Node.js 22.9 이상:

```sh
npm install
npm run build
npm run preview:public
```

http://localhost:4174 에서 실제 배포본을 확인합니다. `npm run dev`는 기존 로컬 Node API 서버를 함께 사용합니다. 정적 배포에서는 같은 경로 계산 코드를 Web Worker에서 실행하므로 API 키 없이 동작합니다. 기존 Sites project_id와 공개 범위를 유지하며, 배포 디렉터리는 `build/`입니다. 이전 `routing.html`, `live.html`, `demo.html` 주소도 동일한 메인 화면으로 연결합니다.

## 지원 범위
| 국가 / 지역 | 실제 경로 계산 범위 | 시간대 |
|---|---|---|
| 홍콩 | 홍콩 전역의 OSM 보행·자전거 도로망 | Asia/Hong_Kong |
| 일본 | 도쿄역·마루노우치, 오사카 나카노시마, 교토 산조·시청 | Asia/Tokyo |

홍콩은 Geofabrik의 홍콩 전체 추출본을 사용합니다. 홍콩섬·구룡·신계·란타우·라마·청차우·퉁핑차우 등에서 실제 연결된 도로를 계산합니다. 전국 데이터 수록은 모든 출발·도착 조합의 연결을 보장한다는 뜻이 아닙니다. 페리·차량 전용 해저 터널·차량 전용 도로는 도보 경로로 연결하지 않으며, 분리된 섬이나 데이터에 연결이 없는 보행로는 오류로 명확히 안내합니다. 일본의 범위는 시범 구역 그대로입니다.

MapTiler 키가 설정되면 선택 국가 전체의 도시·주소·장소를 검색합니다. 키가 없으면 저장된 실제 주요 장소·거리 이름을 사용합니다. 가까운 보행로까지 실제 출입이 가능한지는 검증하지 않습니다. 핀과 경로는 선택 장소 인근의 실제 도로 지점 기준이며, 미확인 접근 구간을 직선 길로 만들지 않습니다.

## 홍콩 전역 데이터와 모바일 실행
- 약 105만 개 도로 노드와 219만 개 방향 연결을 압축 이진 그래프로 배포합니다. 초기 도로 파일 전송은 약 18MB이며 첫 보행로 연결 시 로드합니다. 지도만 볼 때 전체 도로·건물을 받지 않습니다.
- A*가 홍콩 전체 연결 도로에서 최단 시간을 계산합니다. OSM 원본 노드·통행 모드·방향·층을 보존하고 긴 원본 선분을 40m 이하로 나눕니다. 좌표는 1e-7도로 반올림하고 거리는 float32 위쪽 값으로 저장합니다. 새 교차로를 만들지 않습니다.
- OSM의 교량·터널 끝단에서 실제로 같은 OSM 노드를 공유하는 지상 접근 도로만 연결합니다. 평면상 교차, 교량 중간 지점, 명시적인 다른 층은 합치지 않습니다. 양쪽 길에서 허용한 이동 수단만 접속할 수 있습니다.
- 홍콩 정부 Lands Department가 CSDI로 공개한 현존 건물 342,195개를 사용합니다. 모델에서 유효한 높이를 사용할 수 있는 건물은 230,171개이며 나머지 높이 미상·열린 구조물은 불확실합니다. 절대 바닥·지붕 고도의 차이만 건물 높이로 사용하며 바닥 고도를 공중 통로 높이로 오인하지 않습니다. 건물의 지역 지면은 공통 평면으로 놓으므로 경사 지형은 반영되지 않습니다.
- 건물은 약 1km 구역의 gzip 파일로 나눠 경로·현재 지도 주변만 불러옵니다. 기기에는 건물 원본 구역 최대 24개만 캐시합니다. 수집 경계·불러오지 않은 구역으로 뻗는 태양 광선은 햇빛으로 단정하지 않습니다.
- 그늘 후보는 최단 경로 주변 약 1km에서 중간 지점의 예상 태양 위치로 비교하고, 결과 통계는 실제 예상 통과 시각과 여러 표본으로 다시 평가합니다. 전역 최적 경로를 보장하지 않습니다. 계산량 제한에 걸린 후보는 최단 경로를 사용했다고 표시합니다.
- 건물 파일 연결 실패 시 그늘 평가 없이 최단 경로만 표시하며 원인을 안내합니다. 지도 음영은 확대 시 현재 보이는 영역만 계산합니다. 시간 변경·현재 위치·지도 직접 지정은 같은 메인 화면에서 사용합니다.

공개 데이터 출처: [OSM / Geofabrik 홍콩](https://download.geofabrik.de/asia/china/hong-kong.html), [홍콩 정부 CSDI 건물](https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1637211194312_35158), [CSDI 이용 조건](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC). 정부와 CSDI의 출처·지적 재산권 표시는 타일 파일·데이터 명세·지도에 포함합니다. 정부의 보증이나 추천을 뜻하지 않습니다.

## 지도와 검색
MapTiler 키가 있으면 메인 지도는 MapTiler `streets-v4` 타일을 사용하고, 검색은 현재 지도 중심을 우선하는 국가 전체 검색으로 전환됩니다. 일본 `jp`, 홍콩 `hk`로 결과를 제한하며 한국어 표기를 우선합니다. 기존 Leaflet 지도와 현재 위치·경로 레이어는 유지합니다. 이 변경은 2D 지도와 검색 연결이며 MapTiler 건물을 그늘 모델에 연결하거나 3D로 표시하는 작업은 포함하지 않습니다.

### 키 설정
1. `.env.example`을 `.env`로 복사합니다.
2. `.env`의 `MAPTILER_KEY=` 뒤에 웹 지도용 API 키를 넣습니다. 선택 사항인 `MAPTILER_STYLE`의 기본값은 `streets-v4`입니다.
3. 로컬 Node 서버는 `npm run dev`로 다시 시작하면 읽습니다. 정적 배포는 `npm run build` 후 새 `build/`을 배포해야 반영됩니다. 빌드 환경에 같은 환경변수를 설정하는 방식도 지원합니다.

`.env`와 `build/`은 Git에서 제외됩니다. 실제 키를 소스 파일에 넣거나 커밋하지 마세요. `dist/map-config.json`은 키 없는 기본 설정이며 빌드 시 `build/map-config.json`에 환경 설정을 생성합니다. 로컬 Node 서버는 같은 경로로 설정을 제공합니다. 키는 웹 지도 요청에 사용하는 브라우저 공개 키이므로 빌드 파일/브라우저에서 확인할 수 있습니다. MapTiler 계정의 **Allowed HTTP origins**에 배포 도메인 `shadow-walk-seokhyun.greylarch35.chatgpt.site`를 지정하세요. 개발용 키는 별도로 만들고 `localhost` 또는 `127.0.0.1`을 허용하세요.

[MapTiler 키 설정 문서](https://docs.maptiler.com/guides/credentials/api-key/), [장소 검색 문서](https://docs.maptiler.com/cloud/api/geocoding/).

키가 없으면 기존 OSM 지도·로컬 장소 검색을 사용합니다. MapTiler 지도 오류 시 기본 지도로 전환하고, 검색 오류 시 원인을 안내하며 로컬 결과를 사용합니다. 국가 전역에서 찾은 장소는 지원 범위 밖이어도 지도에 핀을 표시합니다. 홍콩은 전역 도로망을 사용하고 일본은 같은 시범 구역의 보행로에 연결된 두 장소에서만 계산합니다.

타일을 사전 수집하거나 오프라인 저장하지 않습니다. 출처를 지도에 표시하며 필요한 화면 영역만 요청합니다. 지도 영역은 지도 제공자에게 전달되고, MapTiler 검색 사용 시 검색어·국가·지도 중심 좌표를 MapTiler에 전달합니다. 사용자 GPS는 내 위치 버튼을 누르고 권한을 허용한 경우에만 사용합니다.

## 실제 경로·그늘 모델
- 최소 힙 Dijkstra로 도보/자전거 통행·방향 제한을 처리합니다. OSM 노드 ID와 level/layer를 보존하며, 평면상 교차하는 선을 임의 연결하지 않습니다. 계단·엘리베이터는 명시된 층 연결을 사용할 수 있을 때만 연결합니다.
- 일본 시범 구역에서는 높이 있는 Overture 건물/부분 다각형에 태양 방향 광선을 쏘아 직사광선 차단을 추정합니다. 내부 빈 공간과 MultiPolygon을 보존합니다. Overture v2 스키마에 따라 최고점은 `min_height + height`입니다. 층수로 임의 높이를 만들지 않습니다.
- 태양 위치는 1분 단위, 구간은 3~12개 지점에서 예상 통과 시각을 샘플링합니다. 지도 음영은 출발 시각의 약 30m 간격 지상 표본이며 정확한 그림자 경계가 아닙니다.
- 이동 시간에 햇빛/평가 불가 비용을 더해 최단 시간·균형·그늘 우선 후보를 비교합니다. 단일 라벨을 사용하는 시간 의존 근사이므로 전역 최적성이나 개선을 보장하지 않습니다. 같은 경로가 나올 수 있습니다.
- 햇빛·그늘·평가 불가·야간을 분 단위로 구분합니다. 평가 비율은 정확도 점수가 아닙니다. 높이/층 높이 미상, 불투명 여부를 모르는 지붕 통로, 자료 경계, 낮은 태양 등은 평가 불가로 처리하고 탐색에서 햇빛과 같은 비용을 줍니다.
- 공통 평면 지면과 불투명 건물을 가정하며 광선 탐색 반경은 500m입니다. 경사 지형·날씨·가로수·유리 투과·실시간 폐쇄·회전 제한·시간대별 출입 제한·실시간 GPS 안내는 미반영입니다. 현장 검증 전입니다.

초기 시각은 선택한 지역의 현재 시각이며 매분·탭 복귀 시 갱신합니다. 날짜/시간을 직접 바꾸면 선택 모드로 전환합니다. 지금 버튼으로 복귀하며, 지역 변경 시 UTC 출발 순간을 보존합니다.

## 데이터 재현
`fixtures/public/`에 배포용 공개 OSM 도로망·건물·검색 색인을 저장합니다. `hongkong-country/`는 압축 국가 도로망과 정부 건물 타일이며 일본 시범 구역은 Overture를 사용합니다. 건물 형상/높이는 보존하고 불필요한 메타데이터를 줄여 전송 크기를 낮춥니다. 원본 릴리스·범위·수집 시각·SHA256·출처를 보존합니다. 사용자 위치나 API 키가 아닙니다. 원본 다운로드 파일과 `.env`는 Git에서 제외합니다.

원본 갱신에는 프로젝트 전용 Overture CLI가 필요합니다:

```sh
python3 -m venv .tools/overture
.tools/overture/bin/python -m pip install -r requirements-buildings.txt
npm run data:region -- tokyo
npm run index:region -- tokyo
npm run snapshot:region -- tokyo
npm run build
```

이 시범 구역 준비 명령의 지원 인자는 tokyo/osaka/kyoto입니다. 홍콩은 아래 전역 준비 명령을 사용합니다. 서버 제한 시 반복 요청하지 말고 안내된 시간 이후 다시 시도합니다. API 경로 요청 시 공개 데이터 서버를 호출하지 않습니다. 현재 Overture 릴리스는 2026-09-23.1입니다. 일본 PLATEAU 및 정밀 지형 자료를 통한 보완은 아직 미연결입니다.

홍콩 데이터 재생성:

```sh
.tools/overture/bin/python -m pip install -r requirements-hongkong.txt
npm run data:hongkong
npm run build
```

원본 PBF·정부 API 페이지·`.env`는 Git에서 제외됩니다. 정부 API는 3,000개씩 순서대로 읽으며 누락·중복·오류를 감지합니다. 재시도 시 이미 받은 페이지를 사용합니다. 데이터 갱신 시 페이지 캐시는 같은 원본 스냅샷에만 사용해야 합니다.

## 검증
```sh
npm test
npm run verify:regions
npm run verify:country
npm run verify:shade
```

자동 테스트와 별도 지역별 실제 데이터 통합 검증. 메인 화면의 검색 결과 선택 → 경로 비교 → 지도 표시, 지역 전환 및 모바일 흐름은 브라우저에서 확인합니다. 검증 기록: `data/hongkong-country-verification.json`, `data/regions-verification.json`, `data/hongkong-shade-verification.json`. 현장 정확도 검증을 대체하지 않습니다.

출처: [OSM / ODbL](https://www.openstreetmap.org/copyright), [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/), [Leaflet](https://leafletjs.com/), [Overture / ODbL](https://docs.overturemaps.org/attribution/), [NOAA 태양 계산](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
