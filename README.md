# 그늘길 · Shadow
메인 화면에서 지역과 출발지·도착지를 검색하고, 시간대별 햇빛 노출을 비교한 경로를 실제 지도 위에 표시합니다. 흰색·블루 디자인과 하단 출발 시간 선택을 유지합니다. 별도의 엔진/API 화면으로 이동하지 않습니다.

## 실행
Node.js 22.9 이상:

```sh
npm install
npm run build
npm run preview:public
```

http://localhost:4174 에서 실제 배포본을 확인합니다. `npm run dev`는 기존 로컬 Node API 서버를 함께 사용합니다. 정적 배포에서는 같은 경로 계산 코드를 Web Worker에서 실행하므로 API 키 없이 동작합니다. 기존 Sites project_id와 공개 범위를 유지하며, 배포 디렉터리는 `out/`입니다. 이전 `routing.html`, `live.html`, `demo.html` 주소도 동일한 메인 화면으로 연결합니다.

## 지원 범위
| 지역 | 실제 도로 시범 구역 | 시간대 | 검색 가능한 항목 |
|---|---|---|---:|
| 홍콩 | 센트럴 | Asia/Hong_Kong | 1,974 |
| 도쿄 | 도쿄역·마루노우치 | Asia/Tokyo | 1,620 |
| 오사카 | 나카노시마 | Asia/Tokyo | 2,624 |
| 교토 | 산조·시청 | Asia/Tokyo | 1,247 |

도시 전체를 포함하지 않습니다. 지역을 바꾸면 지도·검색 색인·도로망·건물 자료·시간대가 함께 바뀝니다. 입력한 이름으로 로컬 데이터에서 실제 장소와 거리를 검색합니다. 검색 결과를 선택해야 경로가 계산됩니다. 한글 별칭과 원본 영문/일문 명칭을 지원하고, 가까운 동일 장소 출입구는 중복을 줄입니다. 전체 세계의 주소 검색은 아직 미연결입니다.

장소는 데이터에 등록된 보행로 지점 또는 50m 이내의 가까운 지상 보행로에 연결합니다. 가까운 지점까지 실제 출입이 가능한지를 검증한 것은 아닙니다. 지도 핀과 경로는 그 보행로 기준이며, 확인되지 않은 접근 구간을 직선으로 연결해 길처럼 표시하지 않습니다.

## 지도와 검색
현재 배경 지도는 Leaflet 1.9.4와 OpenStreetMap 표준 타일을 사용합니다. 필요한 화면 영역만 요청하고 브라우저의 캐시·Referer 기본 동작을 유지하며 지도 출처를 표시합니다. 오프라인 다운로드나 타일 사전 수집은 제공하지 않습니다. 공급자의 서비스 보장은 없으며 확대 운영 전 MapTiler 등 적절한 공급자로 전환할 수 있습니다. 타일 연결 실패 시 실제 도로 형상으로 대체합니다.

MapTiler는 필수가 아니며 추후 지도·전 세계 장소 검색 공급자로 설정할 수 있습니다. 현재 메인 화면의 검색·경로 계산은 해당 지역의 공개 자료로 수행하고 키를 요구하지 않습니다. 지도 영역은 OSM 타일 제공자에게 전달됩니다. 사용자 GPS는 내 위치 버튼을 누르고 권한을 허용한 경우에만 사용합니다.

## 실제 경로·그늘 모델
- 최소 힙 Dijkstra로 도보/자전거 통행·방향 제한을 처리합니다. OSM 노드 ID와 level/layer를 보존하며, 평면상 교차하는 선을 임의 연결하지 않습니다. 계단·엘리베이터는 명시된 층 연결을 사용할 수 있을 때만 연결합니다.
- 높이 있는 Overture 건물/부분 다각형에 태양 방향 광선을 쏘아 직사광선 차단을 추정합니다. 내부 빈 공간과 MultiPolygon을 보존합니다. Overture v2 스키마에 따라 최고점은 `min_height + height`입니다. 층수로 임의 높이를 만들지 않습니다.
- 태양 위치는 1분 단위, 구간은 3~12개 지점에서 예상 통과 시각을 샘플링합니다. 지도 음영은 출발 시각의 약 30m 간격 지상 표본이며 정확한 그림자 경계가 아닙니다.
- 이동 시간에 햇빛/평가 불가 비용을 더해 최단 시간·균형·그늘 우선 후보를 비교합니다. 단일 라벨을 사용하는 시간 의존 근사이므로 전역 최적성이나 개선을 보장하지 않습니다. 같은 경로가 나올 수 있습니다.
- 햇빛·그늘·평가 불가·야간을 분 단위로 구분합니다. 평가 비율은 정확도 점수가 아닙니다. 높이/층 높이 미상, 불투명 여부를 모르는 지붕 통로, 자료 경계, 낮은 태양 등은 평가 불가로 처리하고 탐색에서 햇빛과 같은 비용을 줍니다.
- 공통 평면 지면과 불투명 건물을 가정하며 광선 탐색 반경은 500m입니다. 경사 지형·날씨·가로수·유리 투과·실시간 폐쇄·회전 제한·시간대별 출입 제한·실시간 GPS 안내는 미반영입니다. 현장 검증 전입니다.

초기 시각은 선택한 지역의 현재 시각이며 매분·탭 복귀 시 갱신합니다. 날짜/시간을 직접 바꾸면 선택 모드로 전환합니다. 지금 버튼으로 복귀하며, 지역 변경 시 UTC 출발 순간을 보존합니다.

## 데이터 재현
`fixtures/public/`에 배포용 공개 OSM 도로망·Overture 건물·검색 색인을 저장합니다. 건물 형상/높이는 보존하고 불필요한 메타데이터를 줄여 전송 크기를 낮춥니다. 원본 릴리스·범위·수집 시각·SHA256·출처를 보존합니다. 사용자 위치나 API 키가 아닙니다. 원본 다운로드 파일과 `.env`는 Git에서 제외합니다.

원본 갱신에는 프로젝트 전용 Overture CLI가 필요합니다:

```sh
python3 -m venv .tools/overture
.tools/overture/bin/python -m pip install -r requirements-buildings.txt
npm run data:region -- tokyo
npm run index:region -- tokyo
npm run snapshot:region -- tokyo
npm run build
```

지원 인자는 hongkong/tokyo/osaka/kyoto입니다. 서버 제한 시 반복 요청하지 말고 안내된 시간 이후 다시 시도합니다. API 경로 요청 시 공개 데이터 서버를 호출하지 않습니다. 현재 Overture 릴리스는 2026-09-23.1입니다. 일본 PLATEAU 및 정밀 지형 자료를 통한 보완은 아직 미연결입니다.

## 검증
```sh
npm test
npm run verify:regions
npm run verify:shade
```

45개 테스트와 별도 지역별 실제 데이터 통합 검증. 메인 화면의 검색 결과 선택 → 경로 비교 → 지도 표시, 지역 전환 및 모바일 흐름은 브라우저에서 확인합니다. 검증 기록: `data/regions-verification.json`, `data/hongkong-shade-verification.json`. 현장 정확도 검증을 대체하지 않습니다.

출처: [OSM / ODbL](https://www.openstreetmap.org/copyright), [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/), [Leaflet](https://leafletjs.com/), [Overture / ODbL](https://docs.overturemaps.org/attribution/), [NOAA 태양 계산](https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
