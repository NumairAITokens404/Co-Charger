begin;
alter table public.charger_spots drop constraint charger_spots_city_check, drop constraint charger_spots_latitude_check, drop constraint charger_spots_longitude_check;
alter table public.charger_spots alter column city drop default;
alter table public.charger_spots add constraint charger_spots_city_check check (char_length(trim(city)) between 2 and 80), add constraint charger_spots_latitude_check check (latitude between 6 and 37.6), add constraint charger_spots_longitude_check check (longitude between 68 and 97.5);
alter policy "Anyone can see Hyderabad spots" on public.charger_spots rename to "Anyone can see charger spots";
insert into public.charger_spots (title,area,city,latitude,longitude,plug_type,hourly_rate,is_demo)
select v.*,true from (values
('Bandra apartment plug','Bandra West','Mumbai',19.060,72.835,'Type 2',120),
('Andheri spare cable','Andheri East','Mumbai',19.117,72.863,'15A socket',75),
('Indiranagar home plug','Indiranagar','Bengaluru',12.978,77.640,'Type 2',100),
('Koramangala spare cable','Koramangala','Bengaluru',12.935,77.624,'Portable EVSE',85),
('Saket driveway plug','Saket','New Delhi',28.524,77.206,'Type 2',110),
('Salt Lake home cable','Salt Lake','Kolkata',22.586,88.417,'15A socket',65),
('Adyar neighbourhood plug','Adyar','Chennai',13.006,80.257,'Type 2',90),
('Baner home charger','Baner','Pune',18.560,73.786,'Portable EVSE',80),
('Navrangpura spare cable','Navrangpura','Ahmedabad',23.037,72.561,'15A socket',60),
('C-Scheme driveway','C-Scheme','Jaipur',26.907,75.797,'Type 2',95),
('Gomti Nagar home plug','Gomti Nagar','Lucknow',26.856,81.008,'15A socket',65),
('Panampilly cable spot','Panampilly Nagar','Kochi',9.956,76.299,'Portable EVSE',70),
('Sector 35 spare charger','Sector 35','Chandigarh',30.727,76.760,'Type 2',90),
('Dispur neighbourhood cable','Dispur','Guwahati',26.143,91.790,'15A socket',60),
('Patia home plug','Patia','Bhubaneswar',20.355,85.822,'Type 2',80),
('Panaji home charger','Panaji','Goa',15.491,73.828,'Portable EVSE',85),
('Vijay Nagar spare cable','Vijay Nagar','Indore',22.753,75.894,'15A socket',65),
('Marine Hill demo plug','Marine Hill','Sri Vijaya Puram',11.675,92.744,'15A socket',75)
) v(title,area,city,latitude,longitude,plug_type,hourly_rate)
where not exists (select 1 from public.charger_spots s where s.is_demo and s.title=v.title and s.city=v.city);
commit;
