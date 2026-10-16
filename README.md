# 그늘길 · Shadow
시간대에 따른 햇빛 노출을 줄이는 도보·자전거 길찾기 프로젝트. 현재는 가상 그늘 시뮬레이션과 홍콩 실제 도로를 사용하는 자체 경로 엔진이 있습니다.

## 실행
Node.js 22.9 이상. 런타임 npm 의존성은 없습니다.

```sh
npm run dev
```

- http://localhost:4173/ — 가상 도로·건물로 그늘 경로 시뮬레이션
- http://localhost:4173/routing.html — API 키 없는 실제 도로 엔진 검증
- http://localhost:4173/live.html — MapTiler 지도·장소 검색 + 자체 경로 API

개발 서버는 localhost에만 바인딩합니다. 모바일의 localhost는 이 컴퓨터를 가리키지 않습니다. 기존 Sites 배포는 정적 시뮬레이션이며 Node API 서버를 실행하지 않습니다. GitHub 푸시는 배포가 아닙니다.

## 홍콩 실제 도로 준비
작은 센트럴 시범 구역을 OSM 공식 API에서 한 번 가져오고 로컬 그래프로 변환합니다. 경로 요청 때 OSM 서버에 요청하지 않습니다.

```sh
npm run data:hongkong
npm run verify:hongkong
```

조회 범위는 **서쪽 경도, 남쪽 위도, 동쪽 경도, 북쪽 위도** `[114.151,22.278,114.166,22.286]`입니다. OSM API는 경계와 만나는 도로의 전체 형상을 반환하므로 일부 구간은 조회 범위 밖까지 이어집니다. 도시 전체를 포함하지 않습니다. 확장 시 지역별 추출 파일을 사용해야 합니다.

이미 준비한 OSM JSON은 다음처럼 가져옵니다:

```sh
npm run import:osm -- data/hongkong.osm.json hongkong
```

지원 파일 이름은 hongkong/tokyo/osaka/kyoto입니다. 실제 다운로드·검증한 곳은 홍콩뿐입니다. 원본/변환 데이터는 대용량 파일이므로 Git에서 제외하며, 검증 요약은 `data/hongkong-verification.json`에 기록합니다. 신규 체크아웃에서는 먼저 데이터를 가져와야 합니다.

## 자체 경로 엔진
`routing/engine.mjs`: WGS84 좌표의 구간 거리와 이동 시간을 계산하는 최소 힙 기반 Dijkstra 탐색. 도보/자전거별 통행 가능 방향과 계단 회피를 반영합니다. 가상 SVG 격자와 독립적인 엔진입니다.

`routing/osm.mjs`: OSM 노드 ID로 실제 연결을 보존합니다. 화면에서 선이 교차해도 새 교차로를 만들지 않습니다. 명시된 `level`과 상대 입체 관계 `layer`를 구분하고, 층/레이어가 다른 노드를 임의로 합치지 않습니다. `layer`를 실제 높이(m)로 해석하지 않습니다.

- 계단·엘리베이터와 다층 엘리베이터 노드를 처리합니다. 층 이동 도로는 양 끝의 연결 층을 확인할 수 있을 때만 연결합니다. 모호한 층, 누락된 노드, 면 형태 도로는 제외하고 감사 통계에 기록합니다.
- private/no/허용 여부 미상의 접근 규칙, 조건부 접근 규칙, 운행 방향·시간을 처리하지 못하는 에스컬레이터와 불명확한 장벽을 보수적으로 제외합니다. 이는 지역별 모든 법적 통행 규칙을 구현한 것은 아닙니다.
- 자전거 일방통행과 명시된 보행자 일방통행을 적용합니다. 보행로의 자전거 주행은 명시적 허용이 필요합니다. 자전거 끌기/운반은 미지원이며 계단은 자전거 경로에서 제외합니다.
- 계단 없는 경로가 휠체어 접근 가능한 경로라는 뜻은 아닙니다.
- 속도 추정: 도보 75m/분, 자전거 250m/분, 계단 30m/분. 층 변경 계단은 최소 0.35분, 엘리베이터는 구간당 0.75분의 단순 추정이며 실제 높이·대기 시간 데이터가 아닙니다.
- 지명 검색 좌표는 50m 이내의 지상 노드로 연결합니다. 건물 내부·강 건너편 등 실제 접근 가능성을 보장하지 않으므로 접근 거리와 경고를 별도로 반환하며 그 연결의 시간·거리는 경로에 포함하지 않습니다. 검증 화면은 정확한 도로 노드 ID로 탐색합니다. 선분 중간 연결은 후속 과제입니다.

`GET /api/config`에서 `routingEngine: "shadow"`, 도시별 `routingCities` 상태를 반환합니다. `GET /api/route?city=hongkong&startNode=...&endNode=...&mode=walk&avoidSteps=true`는 직접 노드 탐색입니다. `start`/`end`에 JSON `[경도,위도]`를 넣으면 지상 노드 연결을 사용합니다. `GET /api/network?city=hongkong`는 검증 화면의 도로망을 반환합니다.

GraphHopper 호출과 `GRAPHHOPPER_KEY` 의존성을 제거했습니다. **현재 실제 도로 엔진은 일반 이동 시간 경로 1개를 찾으며 건물 그늘 최적화는 아직 연결하지 않았습니다.** 시간대별 출입 제한, 관계형 회전 제한, 실시간 폐쇄, 층 정보 보정, GPS 안내는 미구현입니다. 홍콩 데이터에서 확인한 restriction 관계는 통계에만 기록하며 탐색에는 반영하지 않습니다. 육교·에어브릿지는 입력 데이터의 층과 연결 관계가 충분한 구간만 처리합니다. 현장 검증 전이며 실제 내비게이션으로 사용하지 마세요.

## MapTiler 설정
실제 배경 지도·장소 검색에만 필요합니다. 자체 경로 계산과 엔진 검증 화면에는 키가 필요 없습니다.

```sh
cp .env.example .env
# MAPTILER_KEY 입력 후 서버 재시작
npm run dev
```

MapTiler 키는 지도 요청에 사용되므로 브라우저에 노출됩니다. 현재 동일 키로 서버 검색도 수행하므로 도메인 제한 설정 시 검색이 차단될 수 있습니다. 배포 전 지도용/서버용 키 분리와 서버 사용량 제한이 필요합니다. `.env`는 Git에 포함하지 않습니다. 키 발급 전 실제 MapTiler 통합 검증은 수행하지 않았습니다. 지도 렌더러는 MapLibre GL JS 5.6.1을 사용합니다.

건물 설치 방법: [data/README.md](data/README.md). Overture 건물 및 일본 PLATEAU의 실제 그늘 계산 연결은 다음 단계입니다.

## 시간과 가상 그늘 시뮬레이션
기본 화면은 가상 100m 격자 도로와 가상 직사각형 건물을 사용합니다. 선택한 도시의 위도·경도, UTC 출발 시각, [NOAA 근사 태양 위치](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)를 사용해 그림자를 계산합니다. 대기 굴절·날씨·가로수·지형은 반영하지 않습니다. 경로의 예상 통과 시각을 샘플링해 햇빛 노출 비용을 더하지만 시간 의존 전역 최적 경로를 보장하지 않습니다.

초기에는 서울의 현재 시각이며 매분·탭 복귀 때 갱신합니다. 홍콩 `Asia/Hong_Kong`(UTC+8), 도쿄·오사카·교토 `Asia/Tokyo`(UTC+9), 런던·뉴욕·시드니를 지원합니다. 수동 선택 후 도시를 바꾸면 UTC 순간을 보존합니다. 내 위치는 명시적 권한 허용 후 기기 메모리에서 태양 계산에만 쓰며 기기의 시간대를 사용합니다. MapTiler 장소 검색어는 서비스에 전달되고 실제 경로 계산은 자체 서버에서 수행합니다.

## 검증
```sh
npm test
npm run verify:hongkong
```

32개 테스트: 기존 시뮬레이션·시간대, 층 분리·계단·엘리베이터, 접근 제한·일방통행, 불완전 데이터 처리, 독립적인 완화 알고리즘과 무작위 그래프 최단 경로 비교. 실제 홍콩 데이터는 추가 명령으로 HTTP 설정 → 도로망 → 경로 API까지 검증합니다. 현장 지리 검증과 브라우저 시각 검증을 대체하지 않습니다.

출처: [OSM 데이터와 라이선스](https://www.openstreetmap.org/copyright) · [OSM API](https://wiki.openstreetmap.org/wiki/API_v0.6) · [OSM 실내 구조](https://wiki.openstreetmap.org/wiki/Simple_Indoor_Tagging) · [MapTiler](https://docs.maptiler.com/cloud/api/) · [Overture](https://docs.overturemaps.org/getting-data/overturemaps-py/)
