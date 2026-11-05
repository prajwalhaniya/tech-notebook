import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={styles.heroBanner}>
      <div className="container">
        <div className={styles.heroContent}>
          <span className={styles.eyebrow}>Engineering Notebook</span>

          <h1 className={styles.heroTitle}>Notes on building software.</h1>

          <p className={styles.heroDescription}>
            A running set of notes on programming, system design, databases,
            and the engineering fundamentals underneath. Organized like a
            notebook — by topic, in order, nothing in the way.
          </p>

          <Link className={styles.heroLink} to="/docs/intro">
            Start from page one <span>→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <Layout
      title="Home"
      description="A comprehensive technical knowledge base covering programming fundamentals, technology deep-dives, system design, and software engineering best practices">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
