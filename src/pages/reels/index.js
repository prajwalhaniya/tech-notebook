import React from 'react';
import Head from '@docusaurus/Head';
import BrowserOnly from '@docusaurus/BrowserOnly';
import ReelsViewer from '@site/src/components/ReelsViewer';
import ReelsHub from '@site/src/components/ReelsHub';
import {REELS_TOPICS} from '@site/src/data/reels';
import useQueryTopic from '@site/src/data/reels/useQueryTopic';

// No topic, or a topic nothing's been generated for yet: show the hub to
// pick one. A known topic goes straight to its deck.
function ReelsRouter() {
  const topic = useQueryTopic();
  return REELS_TOPICS[topic] ? <ReelsViewer /> : <ReelsHub />;
}

export default function ReelsPage() {
  return (
    <>
      <Head>
        <title>Reels | Tech Notebook</title>
        <meta
          name="description"
          content="A swipeable, bite-sized way to read through a topic — one idea per card."
        />
      </Head>
      <BrowserOnly>{() => <ReelsRouter />}</BrowserOnly>
    </>
  );
}
