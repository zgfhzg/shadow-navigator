# 건물·도로 데이터
다운로드된 원본/변환 파일은 Git에서 제외합니다. 검증 요약만 저장소에 포함합니다. 코드 실행 방법은 상위 README를 참고하세요.

## 홍콩 Overture 준비
```sh
python3 -m venv .tools/overture
.tools/overture/bin/python -m pip install -r requirements-buildings.txt
npm run data:buildings -- 2026-09-23.1
```

공식 CLI로 건물과 building_part를 같은 릴리스·범위에서 가져옵니다. 현재 범위는 `[114.140,22.270,114.178,22.294]`입니다. 두 원본의 `.state`에서 릴리스·수집 범위를 확인한 후 결합합니다. macOS에서는 Python의 TLS 검증에 시스템 인증서 `/etc/ssl/cert.pem`을 사용하며 검증을 비활성화하지 않습니다.

- `hongkong.buildings.geojson`, `hongkong.parts.geojson`: 원본, sources·height·min_height·geometry 보존
- 각 `.geojson.state`: 공식 CLI의 다운로드 기록
- `hongkong.geojson`: 서버용 결합 자료와 `shadow` 수집 정보·SHA256
- `hongkong-shade-verification.json`: 실제 HTTP API를 통한 시간대별 검증 요약

기존 다운로드 자료로 다시 결합할 때는 `npm run prepare:buildings -- hongkong`을 사용합니다. 건물과 부분의 릴리스·범위가 다르면 거부합니다. 높이를 임의 생성하지 않습니다. `has_parts`가 있는 부모 roofprint는 통로를 메우지 않도록 미상 형상으로 남기고 알려진 부분의 높이를 사용합니다.

Overture v2 schema의 높이 정의에 따라 최고점을 `min_height + height`로 모델링합니다. 지형 고도가 없으므로 공통 평면을 가정합니다. 출처별 원본 높이의 품질이나 홍콩의 입체 보행망 완성도를 보장하지 않습니다.

## 일본 시범 구역
도쿄역·마루노우치, 오사카 나카노시마, 교토 산조·시청의 실제 OSM 도로·장소와 같은 Overture 릴리스의 건물·부분 자료를 연결했습니다. 지역 전체가 아니라 지정된 시범 범위입니다. `npm run data:region -- tokyo` → `npm run index:region -- tokyo` → `npm run snapshot:region -- tokyo`로 준비합니다. 각 지역의 정확한 범위는 `routing/regions.mjs`에 있습니다. PLATEAU와 정밀 지형 자료는 아직 미연결입니다.

공개 배포 스냅샷은 건물 형상·높이·출처를 유지하면서 부가 메타데이터를 줄입니다. 전처리 시 원본과 모델 통계가 일치하는지 검증하며, 통합 보고서는 `regions-verification.json`에 저장합니다.

출처·라이선스: [Overture / ODbL](https://docs.overturemaps.org/attribution/), [OSM / ODbL](https://www.openstreetmap.org/copyright).
