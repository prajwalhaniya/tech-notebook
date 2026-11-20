import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import NotesWidget from '@site/src/components/NotesWidget';

export default function Root({children}) {
  return (
    <>
      {children}
      <BrowserOnly>{() => <NotesWidget />}</BrowserOnly>
    </>
  );
}
