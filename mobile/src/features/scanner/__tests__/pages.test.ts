import { addPages, MAX_PAGES, movePage, pdfHtml, removePage, roomLeft, scanName } from '../pages';

let n = 0;
const id = () => `p${++n}`;
const three = () => addPages([], ['a', 'b', 'c'], id);

describe('scan pages', () => {
  it('adds pages in order and never goes over five', () => {
    expect(MAX_PAGES).toBe(5);
    const six = addPages([], ['1', '2', '3', '4', '5', '6'], id);
    expect(six.map((p) => p.uri)).toEqual(['1', '2', '3', '4', '5']);
    expect(roomLeft(six)).toBe(0);
    expect(addPages(six, ['x'], id)).toHaveLength(5);
  });

  it('only takes as many as there is room for', () => {
    const p = addPages(addPages([], ['1', '2', '3'], id), ['4', '5', '6', '7'], id);
    expect(p.map((x) => x.uri)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('removes a page by its id', () => {
    const p = three();
    expect(removePage(p, p[1]!.id).map((x) => x.uri)).toEqual(['a', 'c']);
    expect(removePage(p, 'nope')).toHaveLength(3);
  });

  it('moves a page earlier or later and leaves the ends alone', () => {
    const p = three();
    expect(movePage(p, p[1]!.id, -1).map((x) => x.uri)).toEqual(['b', 'a', 'c']);
    expect(movePage(p, p[1]!.id, 1).map((x) => x.uri)).toEqual(['a', 'c', 'b']);
    expect(movePage(p, p[0]!.id, -1).map((x) => x.uri)).toEqual(['a', 'b', 'c']);
    expect(movePage(p, p[2]!.id, 1).map((x) => x.uri)).toEqual(['a', 'b', 'c']);
    expect(movePage(p, 'nope', 1)).toHaveLength(3);
  });

  it('does not change the list it is given', () => {
    const p = three();
    const copy = [...p];
    movePage(p, p[0]!.id, 1);
    removePage(p, p[0]!.id);
    expect(p).toEqual(copy);
  });
});

describe('the PDF', () => {
  it('puts each picture on its own page, inlined as base64, in the given order', () => {
    const html = pdfHtml(['AAA', 'BBB']);
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html.indexOf('AAA')).toBeLessThan(html.indexOf('BBB'));
    expect(html).toContain('data:image/jpeg;base64,AAA');
    expect(html).not.toContain('file://');
  });

  it('names the file by its date and time', () => {
    expect(scanName(new Date(2026, 9, 14, 7, 5))).toBe('scan-2026-10-14-0705.pdf');
  });
});
