# Overture 건물 데이터
각 도시의 GeoJSON FeatureCollection을 이 폴더에 저장합니다. 좌표는 WGS84 [경도, 위도], 원본 height(m), geometry 및 sources를 보존하세요. 대용량 데이터는 Git에서 제외됩니다.

공식 CLI 설치 후 다음과 같이 작은 시범 구역을 가져올 수 있습니다. 이 범위 밖의 건물이 없다는 뜻이 아닙니다.

```sh
pip install overturemaps
overturemaps download --bbox=114.145,22.270,114.175,22.290 -f geojson --type=building -o data/hongkong.geojson
overturemaps download --bbox=139.755,35.670,139.780,35.690 -f geojson --type=building -o data/tokyo.geojson
overturemaps download --bbox=135.490,34.680,135.515,34.705 -f geojson --type=building -o data/osaka.geojson
overturemaps download --bbox=135.755,35.000,135.780,35.022 -f geojson --type=building -o data/kyoto.geojson
```

다운로드 시 사용한 릴리스와 범위, 날짜를 별도로 기록하세요. 높이가 없는 건물은 높이 미상으로 취급하며 층수로 임의 대체하지 않습니다. 현재 화면은 건물 평면만 표시하며 실제 건물 기반 그림자/경로 점수는 미구현입니다. 데이터의 완전성·높이·보행 네트워크 검증 후 연결해야 합니다.

출처·라이선스: https://docs.overturemaps.org/attribution/ (건물 ODbL)
CLI: https://docs.overturemaps.org/getting-data/overturemaps-py/
일본 PLATEAU는 향후 정밀 데이터 보완 대상으로, 아직 연결하지 않았습니다.
