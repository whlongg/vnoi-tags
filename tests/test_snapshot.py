import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / 'scripts' / 'snapshot_public.py'
SPEC = importlib.util.spec_from_file_location('snapshot_public', SCRIPT)
snapshot_public = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot_public)


class SnapshotParserTest(unittest.TestCase):
    def test_separates_sidebar_and_problem_tags(self):
        page = '''
            <div class="accordion"><div class="card">
              <a class="card-toggle">Đồ thị</a>
              <div class="card-body"><a href="?tag_id=graph" tag_id="graph">Đồ thị</a></div>
            </div></div>
            <table id="tagproblem-table"><tbody><tr>
              <td class="problem-code"><a href="/tag/CF_1">CF_1</a></td>
              <td class="problem-name"><a href="/tag/CF_1">Bài mẫu</a>
                <a href="?tag_id=graph" tag_id="graph">Đồ thị</a>
              </td>
              <td class="judge"><a href="https://example.com/problem">Codeforces</a></td>
            </tr></tbody></table>
        '''
        parsed = snapshot_public.parse(page)

        self.assertEqual(
            parsed.groups[0]['tags'],
            [{'code': 'graph', 'name': 'Đồ thị'}],
        )
        self.assertEqual(parsed.problems[0]['tags'], ['graph'])


if __name__ == '__main__':
    unittest.main()
