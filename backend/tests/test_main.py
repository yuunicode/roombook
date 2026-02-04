"""
Pytest는 기본적으로 `backend/tests/` 아래를 뒤지므로, 이 샘플 테스트로
.husky/pre-commit에서 실행되는 pytest 배선이 제대로 동작하는지 확인한다.
추후 여기에 실제 단위 테스트를 채워 넣고 준비가 되면 이 플레이스홀더를 지워도 된다.
"""


def test_sample() -> None:
    """Pytest 수집/실행이 성공하는지 확인하는 스모크 테스트."""
    assert True
