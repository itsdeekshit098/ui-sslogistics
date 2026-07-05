/*
This converts:

Before	After
35 Seater	35
40 Seater	40
5 Seater	5
5	5
''	NULL
*/

UPDATE public.vehicles
SET seating_capacity = NULL
WHERE TRIM(seating_capacity) = '';

UPDATE public.vehicles
SET seating_capacity = REGEXP_REPLACE(seating_capacity, '\D', '', 'g')
WHERE seating_capacity IS NOT NULL;

