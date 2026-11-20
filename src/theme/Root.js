import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import NotesWidget from '@site/src/components/NotesWidget';
import HighlightConcordance from '@site/src/components/HighlightConcordance';

export default function Root({children}) {
  return (
    <>
      {children}
      <BrowserOnly>{() => <NotesWidget />}</BrowserOnly>
      <BrowserOnly>{() => <HighlightConcordance />}</BrowserOnly>
    </>
  );
}
