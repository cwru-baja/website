import { useRef, useEffect, useState, ReactNode } from 'react';
import './FadeIn.module.css';

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    direction?: 'up' | 'down' | 'left' | 'right' | 'none';
    distance?: number;
    threshold?: number;
}

export const FadeIn = ({
       children,
       delay = 0,
       direction = 'up',
       distance = 30,
       threshold = 0.1
   }: FadeInProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [noTransition, setNoTransition] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef<number>(0);
    const isScrollingDown = useRef<boolean>(true);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            isScrollingDown.current = currentScrollY > lastScrollY.current;
            lastScrollY.current = currentScrollY;
        };

        lastScrollY.current = window.scrollY;
        window.addEventListener('scroll', handleScroll);

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    if (isScrollingDown.current) {
                        setNoTransition(false);
                        setIsVisible(true);
                    } else {
                        setNoTransition(true);
                        setIsVisible(true);
                    }
                    observer.disconnect();
                }
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: threshold
            }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, [threshold]);

    let transform = 'translateY(0)';
    if (direction === 'up') transform = `translateY(${distance}px)`;
    if (direction === 'down') transform = `translateY(-${distance}px)`;
    if (direction === 'left') transform = `translateX(${distance}px)`;
    if (direction === 'right') transform = `translateX(-${distance}px)`;

    return (
        <div
            ref={ref}
            className={`fade-in ${isVisible ? 'visible' : ''}`}
            style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translate(0)' : transform,
                transitionProperty: noTransition ? 'none' : 'opacity, transform',
                transitionDuration: noTransition ? '0s' : '0.6s',
                transitionTimingFunction: noTransition ? 'ease' : 'ease-out',
                transitionDelay: noTransition ? '0s' : `${delay}s`
            }}
        >
            {children}
        </div>
    );
};
