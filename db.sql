CREATE TABLE Alerts
(
    id bigint IDENTITY(1,1),
    alert_name varchar(100),
    alter_desc varchar(200),
    machine_name varchar(100),
    raised_on datetime2,
    status varchar(100),
    closed_on datetime2
)