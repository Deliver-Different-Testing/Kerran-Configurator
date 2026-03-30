namespace DfrntDriveConfigurator.Core.Domain.Enums;

public enum ActionType
{
    UpdateJobStatus,
    CreateTask,
    CompleteTask,
    TriggerNotification,
    SendSms,
    ChangeStatus,
    SendEmail
}

public enum EmailRecipientType
{
    TrackingEmail,
    ProofOfDeliveryEmail,
    ClientContactEmail,
    AgentEmail,
    Custom
}

public enum ConditionType
{
    JobUnassigned,
    JobAssigned,
    BeforeScheduledTime,
    AfterScheduledTime,
    AtScheduledTime,
    Status,
    Scan
}

public enum ConditionMatchMode
{
    All,
    Any
}

public enum JobTypeFilter
{
    All,
    Pickup,
    Delivery,
    Transfer,
    Collection
}

public enum ScanType
{
    Sort,
    Run,
    Transit,
    Inwards,
    Pickup,
    Transfer,
    Delivery,
    Collection,
    ReturnToSender
}

public enum ScheduledTimeField
{
    Pickup,
    Delivery,
    Flight
}

public enum SmsRecipientType
{
    CustomerContact,
    Driver,
    FixedNumber
}

public enum StatusConditionMode
{
    AnyChange,
    ChangesTo,
    Leaves,
    IsNot
}

public enum TriggerType
{
    StatusChange,
    ScanEvent,
    SupportEvent,
    ManualTrigger,
    TimeBased
}
