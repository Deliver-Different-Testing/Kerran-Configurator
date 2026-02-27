using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdminManager.Core.Domain.Despatch
{
    /// <summary>
    /// Links an AccessorialCharge to a workflow step (TucEventType).
    /// When a job has accessorial charges, the corresponding workflow tasks
    /// are injected into the base workflow at the appropriate stage.
    /// 
    /// Stage IDs:
    ///   1 = Enroute to Pickup
    ///   2 = Pickup
    ///   3 = Enroute to Delivery
    ///   4 = Delivery
    /// </summary>
    [Table("AccessorialWorkflowTask")]
    public class AccessorialWorkflowTask
    {
        [Key]
        [Column("Id")]
        public int Id { get; set; }

        [Column("AccessorialChargeId")]
        public int AccessorialChargeId { get; set; }

        [Column("EventTypeId")]
        public int EventTypeId { get; set; }

        /// <summary>
        /// Which job stage: 1=Enroute to Pickup, 2=Pickup, 3=Enroute to Delivery, 4=Delivery
        /// </summary>
        [Column("StageId")]
        public int StageId { get; set; }

        [Column("Sequence")]
        public int Sequence { get; set; }

        [Column("Required")]
        public bool Required { get; set; } = true;

        /// <summary>
        /// Step-specific configuration as JSON. Used by the generic fallback renderer
        /// when the MAUI app doesn't have a native renderer for this event type.
        /// </summary>
        [Column("ConfigJson")]
        public string? ConfigJson { get; set; }

        [Column("Active")]
        public bool Active { get; set; } = true;

        // Navigation properties
        [ForeignKey("EventTypeId")]
        public virtual TucEventType? EventType { get; set; }
    }
}
