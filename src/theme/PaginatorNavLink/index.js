import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

export default function PaginatorNavLink(props) {
  const {permalink, title, subLabel, isNext} = props;
  const arrow = (
    <span className={styles.arrow} aria-hidden="true">
      {isNext ? '→' : '←'}
    </span>
  );
  return (
    <Link
      className={clsx(
        'pagination-nav__link',
        isNext ? 'pagination-nav__link--next' : 'pagination-nav__link--prev',
        styles.navLink,
        isNext ? styles.navLinkNext : styles.navLinkPrev,
      )}
      to={permalink}>
      {!isNext && arrow}
      <span className={styles.body}>
        {subLabel && (
          <span className={clsx('pagination-nav__sublabel', styles.subLabel)}>
            {subLabel}
          </span>
        )}
        <span className={clsx('pagination-nav__label', styles.label)}>
          {title}
        </span>
      </span>
      {isNext && arrow}
    </Link>
  );
}
