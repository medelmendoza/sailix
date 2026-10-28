import { render, screen } from '@testing-library/react-native';
import { HostContext } from '../../host';
import { hostOf } from '../../testing/render';
import { GlyphIcon } from '../GlyphIcon';

describe('GlyphIcon', () => {
  it('draws the book used for My Courses, hidden from screen readers like every icon', async () => {
    await render(
      <HostContext.Provider value={hostOf()}>
        <GlyphIcon name="book" />
      </HostContext.Provider>,
    );
    expect(screen.toJSON()).toMatchObject({ props: { accessibilityElementsHidden: true } });
  });
});
